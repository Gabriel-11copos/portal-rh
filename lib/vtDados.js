// Vale-transporte: tudo o que mexe no banco. As regras de valor ficam em lib/vt.js (a mesma da tela).

const V = require('./vt');
const D = require('./dadosPessoais');
const { guardarDocumento } = require('./guardarDocumento');

const FUSO = 'America/Sao_Paulo';
const MODALIDADES_COM_CARTAO = ['jae', 'riocard', 'jae_riocard'];
const MAX_TOTAL = 4.2 * 1024 * 1024;   // o Vercel limita o envio inteiro a ~4,5 MB: as duas fotos juntas
const MSG_REABRIR = 'Para voltar a usar o vale-transporte, abra uma solicitação ao RH. Quando o RH liberar, você preenche de novo.';

const lista = (s) => { try { const x = JSON.parse(s || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
const instalado = (p) => !!(p.transporteColaborador && p.transporteHistorico && p.coletaVT && p.saldoVT && p.unidadeTransporte && p.regraVT);
const agoraBR = (d = new Date()) => { const [ano, mes, dia] = d.toLocaleDateString('en-CA', { timeZone: FUSO }).split('-').map(Number); return { ano, mes, dia }; };
const competenciaDe = (d) => { const { ano, mes } = agoraBR(new Date(d)); return `${String(mes).padStart(2, '0')}/${ano}`; };
const texto = (v, min, max) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s.length >= min && s.length <= max ? s : null; };

async function lerRegras(prisma) {
  try { const r = await prisma.regraVT.findUnique({ where: { id: 'unico' } }); if (r) return { jae: r.jaeCentavos, riocardUm: r.riocardUmCentavos, riocardIntegracao: r.riocardIntegracaoCentavos }; } catch { /* usa os padrões */ }
  return { ...V.REGRAS_PADRAO };
}
const unidadeDe = (prisma, loja) => (loja ? prisma.unidadeTransporte.findUnique({ where: { loja } }) : Promise.resolve(null));

// ---------- validação do que o colaborador preenche
function lerOrigem(corpo) {
  const erros = []; const o = {};
  const cep = D.lerCep(corpo.cep); if (!cep) erros.push('Informe o CEP da sua casa com 8 números.'); else o.origemCep = cep;
  const logradouro = texto(corpo.logradouro, 3, 120); if (!logradouro) erros.push('Informe a rua da sua casa.'); else o.origemLogradouro = logradouro;
  const numero = texto(corpo.numero, 1, 10); if (!numero) erros.push('Informe o número da sua casa (ou S/N).'); else o.origemNumero = numero;
  const bairro = texto(corpo.bairro, 2, 80); if (!bairro) erros.push('Informe o bairro.'); else o.origemBairro = bairro;
  const cidade = texto(corpo.cidade, 2, 80); if (!cidade) erros.push('Informe a cidade.'); else o.origemCidade = cidade;
  const uf = String(corpo.uf || '').trim().toUpperCase(); if (!D.UFS.includes(uf)) erros.push('Escolha o estado (UF).'); else o.origemUf = uf;
  const comp = String(corpo.complemento || '').replace(/\s+/g, ' ').trim(); if (comp.length > 60) erros.push('O complemento pode ter no máximo 60 letras.'); else o.origemComplemento = comp || null;
  return { erros, o };
}

function lerMapeamento(corpo, regras) {
  if (!corpo || typeof corpo !== 'object') return { erros: ['Envie os dados do mapeamento.'] };
  if (typeof corpo.usaVT !== 'boolean') return { erros: ['Diga se você usa vale-transporte.'] };
  if (!corpo.usaVT) {
    if (corpo.aceiteTermo !== true) return { erros: ['Para continuar, leia o termo e marque que você aceita.'] };
    return { erros: [], dados: { usaVT: false, modalidade: 'nao_usa', transportesJae: [], transportesRiocard: [], valorViagem: 0, valorDia: 0, alertas: [] } };
  }
  const modalidade = String(corpo.modalidade || '');
  if (!['jae', 'riocard', 'jae_riocard', 'diferente'].includes(modalidade)) return { erros: [V.MSG.modalidade_invalida] };
  const erros = [];
  const { erros: eo, o } = lerOrigem(corpo.origem || {}); erros.push(...eo);
  const jae = modalidade === 'riocard' || modalidade === 'diferente' ? [] : Array.isArray(corpo.jae) ? corpo.jae : [];
  const riocard = modalidade === 'jae' || modalidade === 'diferente' ? [] : Array.isArray(corpo.riocard) ? corpo.riocard : [];
  const caso = modalidade === 'diferente' ? texto(corpo.casoDiferente, 10, 500) : null;
  const calc = V.calcular({ modalidade, jae, riocard, casoDiferente: caso || '' }, regras);
  if (!calc.ok) erros.push(calc.erro);
  let buiAtivo = null;
  if (modalidade === 'riocard' || modalidade === 'jae_riocard') {
    buiAtivo = String(corpo.buiAtivo || '');
    if (!['sim', 'nao', 'nao_sei'].includes(buiAtivo)) erros.push('Diga se você tem o BUI (Bilhete Único Intermunicipal) ativo.');
  }
  let numeroRiocard = null;
  if (corpo.numeroRiocard) { numeroRiocard = String(corpo.numeroRiocard).trim(); if (!/^[0-9 .-]{4,25}$/.test(numeroRiocard)) erros.push('O número do Riocard deve ter só números (de 4 a 25 caracteres).'); }
  if (erros.length) return { erros };
  return { erros: [], dados: { usaVT: true, modalidade, transportesJae: [...new Set(jae)], transportesRiocard: [...new Set(riocard)], numeroRiocard, buiAtivo, casoDiferente: caso, valorViagem: calc.viagem, valorDia: calc.dia, alertas: V.alertasDe({ modalidade, buiAtivo }), origem: o } };
}

// ---------- salvar o mapeamento (colaborador ou RH)
async function salvarMapeamento(prisma, colaborador, corpo, { autor = 'colaborador', nomeAutor = null } = {}) {
  const regras = await lerRegras(prisma);
  const { erros, dados } = lerMapeamento(corpo, regras);
  if (erros.length) return { ok: false, status: 400, erros };
  const atual = await prisma.transporteColaborador.findUnique({ where: { colaboradorId: colaborador.id } });
  // quem declarou que NÃO usa só volta a preencher quando o RH reabrir (por solicitação)
  if (autor === 'colaborador' && atual && atual.usaVT === false && !(atual.reabertoEm && atual.reabertoEm > atual.atualizadoEm)) return { ok: false, status: 403, erros: [MSG_REABRIR] };
  const unidade = await unidadeDe(prisma, colaborador.loja);
  const agora = new Date();
  const base = { usaVT: dados.usaVT, modalidade: dados.modalidade, transportesJae: JSON.stringify(dados.transportesJae), transportesRiocard: JSON.stringify(dados.transportesRiocard), numeroRiocard: dados.numeroRiocard || null, buiAtivo: dados.buiAtivo || null, casoDiferente: dados.casoDiferente || null, valorViagemCentavos: dados.valorViagem, valorDiaCentavos: dados.valorDia, alertas: JSON.stringify(dados.alertas), alertaResolvidoPor: null, alertaResolvidoEm: null, alertaNota: null, reabertoEm: null, lojaDestino: colaborador.loja || null, atualizadoEm: agora };
  let extra;
  if (!dados.usaVT) {
    if (!unidade || !unidade.razaoSocial || !unidade.cnpj) return { ok: false, status: 409, erros: ['A empresa da sua unidade ainda não tem CNPJ cadastrado para gerar o termo. Fale com o RH.'] };
    const termo = V.montarTermo({ empregador: unidade.razaoSocial, cnpj: unidade.cnpj, nome: colaborador.nome, cpf: colaborador.matricula, cargo: colaborador.cargo, unidade: colaborador.loja, data: agora, aceitoEm: agora });
    extra = { termoAceitoEm: agora, termoTexto: termo.texto, origemCep: null, origemLogradouro: null, origemNumero: null, origemComplemento: null, origemBairro: null, origemCidade: null, origemUf: null };
  } else extra = { ...dados.origem, termoAceitoEm: null, termoTexto: null };
  const registro = { ...base, ...extra };
  if (atual) await prisma.transporteColaborador.update({ where: { colaboradorId: colaborador.id }, data: registro });
  else await prisma.transporteColaborador.create({ data: { colaboradorId: colaborador.id, ...registro } });
  await prisma.transporteHistorico.create({ data: { colaboradorId: colaborador.id, motivo: !dados.usaVT ? 'termo_nao_optante' : atual ? 'atualizacao' : 'primeiro_mapeamento', autor: autor === 'rh' ? `rh:${nomeAutor || ''}` : 'colaborador', dados: JSON.stringify({ usaVT: base.usaVT, modalidade: base.modalidade, transportesJae: dados.transportesJae, transportesRiocard: dados.transportesRiocard, buiAtivo: base.buiAtivo, valorViagemCentavos: base.valorViagemCentavos, valorDiaCentavos: base.valorDiaCentavos, casoDiferente: base.casoDiferente, origemBairro: extra.origemBairro || null, origemCidade: extra.origemCidade || null, lojaDestino: base.lojaDestino, regras }) } });
  return { ok: true, usaVT: dados.usaVT, modalidade: dados.modalidade, valorViagem: dados.valorViagem, valorDia: dados.valorDia, alertas: dados.alertas };
}

// ---------- o que a tela do colaborador precisa saber
function valoresDe(reg, quando = agoraBR()) {
  if (!reg || reg.valorDiaCentavos === null || reg.valorDiaCentavos === undefined) return { viagem: reg ? reg.valorViagemCentavos : null, dia: null, mensal: null, diasNoMes: V.diasNoMes(quando.ano, quando.mes), mes: quando.mes, ano: quando.ano };
  return { viagem: reg.valorViagemCentavos, dia: reg.valorDiaCentavos, mensal: V.valorMensal(reg.valorDiaCentavos, quando.ano, quando.mes), diasNoMes: V.diasNoMes(quando.ano, quando.mes), mes: quando.mes, ano: quando.ano };
}
function origemDe(reg) { return reg && reg.origemLogradouro ? { cep: reg.origemCep, logradouro: reg.origemLogradouro, numero: reg.origemNumero, complemento: reg.origemComplemento || '', bairro: reg.origemBairro, cidade: reg.origemCidade, uf: reg.origemUf } : null; }
function linksDe(reg, unidade) {
  const origem = origemDe(reg); const destino = unidade && unidade.endereco;
  if (!origem || !destino) return null;
  const o = V.enderecoEmTexto(origem);
  return { ida: V.linkTrajeto({ origem: o, destino, sentido: 'ida' }), volta: V.linkTrajeto({ origem: o, destino, sentido: 'volta' }) };
}
const coletaAtiva = (prisma, tipo) => prisma.coletaVT.findFirst({ where: { tipo, ativa: true }, orderBy: { criadaEm: 'desc' } });

function pendenciaDe(reg, coletaMapeamento) {
  if (!reg) return 'primeiro';
  if (reg.reabertoEm && reg.reabertoEm > reg.atualizadoEm) return 'reaberto';
  if (reg.usaVT && coletaMapeamento && coletaMapeamento.criadaEm > reg.atualizadoEm) return 'coleta';
  return null;
}

async function statusDoColaborador(prisma, colaborador) {
  if (!instalado(prisma)) return { disponivel: false };
  const [reg, unidade, regras, cMap, cSaldo] = await Promise.all([prisma.transporteColaborador.findUnique({ where: { colaboradorId: colaborador.id } }), unidadeDe(prisma, colaborador.loja), lerRegras(prisma), coletaAtiva(prisma, 'mapeamento'), coletaAtiva(prisma, 'saldo')]);
  const pendencia = pendenciaDe(reg, cMap);
  let saldo = null;
  if (cSaldo && reg && reg.usaVT && MODALIDADES_COM_CARTAO.includes(reg.modalidade)) {
    const s = await prisma.saldoVT.findFirst({ where: { coletaId: cSaldo.id, colaboradorId: colaborador.id } });
    saldo = { coletaId: cSaldo.id, titulo: cSaldo.titulo, prazo: cSaldo.prazo, cartoes: [...(reg.modalidade !== 'riocard' ? ['jae'] : []), ...(reg.modalidade !== 'jae' ? ['riocard'] : [])], anexosMinimos: reg.modalidade === 'jae_riocard' ? 2 : 1, respondido: !!s && s.status === 'enviado', status: s ? s.status : null, motivoRefazer: s ? s.motivoRefazer : null, enviado: s ? { jaeCentavos: s.saldoJaeCentavos, riocardCentavos: s.saldoRiocardCentavos, informadoEm: s.informadoEm } : null };
  }
  return {
    disponivel: true, mapeado: !!reg, pendencia, usaVT: reg ? reg.usaVT : null, modalidade: reg ? reg.modalidade : null,
    jae: reg ? lista(reg.transportesJae) : [], riocard: reg ? lista(reg.transportesRiocard) : [], buiAtivo: reg ? reg.buiAtivo : null, numeroRiocard: reg ? reg.numeroRiocard : null, casoDiferente: reg ? reg.casoDiferente : null,
    origem: origemDe(reg), valores: reg ? valoresDe(reg) : null, regras,
    unidade: unidade ? { loja: unidade.loja, endereco: unidade.endereco || null, semEnderecoFixo: !unidade.endereco } : { loja: colaborador.loja || null, endereco: null, semEnderecoFixo: true },
    links: linksDe(reg, unidade), termo: reg && reg.termoAceitoEm ? { aceitoEm: reg.termoAceitoEm } : null,
    podeEditar: !(reg && reg.usaVT === false && pendencia !== 'reaberto'), atualizadoEm: reg ? reg.atualizadoEm : null, saldo,
  };
}

// o termo que a pessoa vai ler ANTES de aceitar (com os dados dela)
async function termoParaLer(prisma, colaborador) {
  const unidade = await unidadeDe(prisma, colaborador.loja);
  if (!unidade || !unidade.razaoSocial || !unidade.cnpj) return null;
  return V.montarTermo({ empregador: unidade.razaoSocial, cnpj: unidade.cnpj, nome: colaborador.nome, cpf: colaborador.matricula, cargo: colaborador.cargo, unidade: colaborador.loja, data: new Date() });
}

// ---------- coletas (o RH libera; o colaborador responde)
function lerPrazo(v) {
  const p = String(v == null ? '' : v).trim();
  if (!p) return { prazo: null };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(p) ? new Date(`${p}T23:59:59-03:00`) : null;
  if (!d || isNaN(d) || d.toLocaleDateString('en-CA', { timeZone: FUSO }) !== p) return { erro: 'Prazo inválido.' };
  return { prazo: d };
}
async function alvosDaColeta(prisma, tipo) {
  const ativos = await prisma.colaborador.findMany({ where: { ativo: true }, select: { id: true } });
  const regs = new Map((await prisma.transporteColaborador.findMany()).map((r) => [r.colaboradorId, r]));
  return ativos.map((c) => c.id).filter((id) => { const r = regs.get(id); return tipo === 'saldo' ? !!r && r.usaVT && MODALIDADES_COM_CARTAO.includes(r.modalidade) : !r || r.usaVT; });
}
async function criarColeta(prisma, { tipo, titulo, prazo, usuario }) {
  if (!['saldo', 'mapeamento'].includes(tipo)) return { ok: false, status: 400, erro: 'Tipo de coleta inválido.' };
  const t = String(titulo || '').trim() || (tipo === 'saldo' ? 'Saldo do vale-transporte' : 'Mapeamento de transporte');
  if (t.length < 3 || t.length > 80) return { ok: false, status: 400, erro: 'O título precisa ter de 3 a 80 letras.' };
  const p = lerPrazo(prazo); if (p.erro) return { ok: false, status: 400, erro: p.erro };
  if (await coletaAtiva(prisma, tipo)) return { ok: false, status: 409, erro: `Já existe uma coleta de ${tipo === 'saldo' ? 'saldo' : 'mapeamento'} aberta. Encerre-a antes de abrir outra.` };
  const coleta = await prisma.coletaVT.create({ data: { tipo, titulo: t, prazo: p.prazo, criadaPor: usuario || null } });
  return { ok: true, coleta, alvos: await alvosDaColeta(prisma, tipo) };
}
async function encerrarColeta(prisma, id) {
  const c = await prisma.coletaVT.findUnique({ where: { id } });
  if (!c) return { ok: false, status: 404, erro: 'Coleta não encontrada.' };
  await prisma.coletaVT.update({ where: { id }, data: { ativa: false } });
  return { ok: true };
}
async function listarColetas(prisma) {
  const coletas = await prisma.coletaVT.findMany({ orderBy: { criadaEm: 'desc' }, take: 24 });
  const regs = await prisma.transporteColaborador.findMany(); const out = [];
  for (const c of coletas) {
    const alvos = await alvosDaColeta(prisma, c.tipo);
    let respondidos;
    if (c.tipo === 'saldo') { const s = await prisma.saldoVT.findMany({ where: { coletaId: c.id } }); const ids = new Set(alvos); respondidos = s.filter((x) => x.status === 'enviado' && ids.has(x.colaboradorId)).length; }
    else { const m = new Map(regs.map((r) => [r.colaboradorId, r])); respondidos = alvos.filter((id) => m.get(id) && m.get(id).atualizadoEm >= c.criadaEm).length; }
    out.push({ id: c.id, tipo: c.tipo, titulo: c.titulo, prazo: c.prazo, ativa: c.ativa, criadaEm: c.criadaEm, alvos: alvos.length, respondidos });
  }
  return out;
}

// ---------- saldo
async function registrarSaldo(prisma, colaborador, { coletaId, saldoJae, saldoRiocard, arquivos = [] }) {
  const coleta = await prisma.coletaVT.findUnique({ where: { id: coletaId || '' } });
  if (!coleta || coleta.tipo !== 'saldo' || !coleta.ativa) return { ok: false, status: 404, erros: ['Esta coleta de saldo não está mais aberta.'] };
  const reg = await prisma.transporteColaborador.findUnique({ where: { colaboradorId: colaborador.id } });
  if (!reg || !reg.usaVT || !MODALIDADES_COM_CARTAO.includes(reg.modalidade)) return { ok: false, status: 409, erros: ['Faça primeiro o mapeamento do seu transporte.'] };
  const erros = []; const precisaJae = reg.modalidade !== 'riocard'; const precisaRio = reg.modalidade !== 'jae';
  let jae = null; let rio = null;
  if (precisaJae) { jae = V.lerReais(saldoJae); if (jae === null) erros.push('Informe o saldo do cartão Jaé (ex.: 12,50).'); }
  if (precisaRio) { rio = V.lerReais(saldoRiocard); if (rio === null) erros.push('Informe o saldo do cartão Riocard (ex.: 12,50).'); }
  const minimo = reg.modalidade === 'jae_riocard' ? 2 : 1;
  if (arquivos.length < minimo) erros.push(minimo === 2 ? 'Anexe o comprovante dos dois cartões (Jaé e Riocard): são 2 arquivos.' : 'Anexe pelo menos 1 foto ou PDF do saldo.');
  if (arquivos.length > 2) erros.push('Anexe no máximo 2 arquivos.');
  const lidos = [];
  for (const a of arquivos.slice(0, 2)) {
    const tipo = D.tipoDeArquivo(a.buffer);
    if (!tipo) { erros.push(`O arquivo "${a.nome || 'sem nome'}" precisa ser foto (JPG ou PNG) ou PDF.`); continue; }
    if (a.buffer.length > D.MAX_COMPROVANTE) { erros.push(`O arquivo "${a.nome || 'sem nome'}" passa de 4 MB. Tire a foto de novo com menos qualidade.`); continue; }
    lidos.push({ buffer: a.buffer, extensao: tipo.ext, mimeType: tipo.mime });
  }
  if (!erros.length && lidos.reduce((n, x) => n + x.buffer.length, 0) > MAX_TOTAL) erros.push('Os arquivos juntos passam de 4 MB. Use fotos com menos qualidade ou um PDF menor.');
  if (erros.length) return { ok: false, status: 400, erros };
  const dia = agoraBR(new Date(coleta.criadaEm)); const rotuloDia = `${String(dia.dia).padStart(2, '0')}-${String(dia.mes).padStart(2, '0')}`;
  const anexos = [];
  for (let i = 0; i < lidos.length; i++) {
    const r = await guardarDocumento(prisma, { colaborador, tipo: `${V.PREFIXO_DOC_SALDO}${rotuloDia} (${i + 1})`, competencia: competenciaDe(coleta.criadaEm), buffer: lidos[i].buffer, extensao: lidos[i].extensao, mimeType: lidos[i].mimeType, avisarColaborador: false });
    if (!r.ok) return { ok: false, status: r.status || 502, erros: [r.erro || 'Não foi possível guardar o arquivo. Tente de novo.'] };
    anexos.push({ url: r.url, nome: `Comprovante ${i + 1}` });
  }
  const dados = { saldoJaeCentavos: jae, saldoRiocardCentavos: rio, anexos: JSON.stringify(anexos), status: 'enviado', motivoRefazer: null, informadoEm: new Date() };
  const existente = await prisma.saldoVT.findFirst({ where: { coletaId: coleta.id, colaboradorId: colaborador.id } });
  if (existente) await prisma.saldoVT.update({ where: { id: existente.id }, data: dados });
  else await prisma.saldoVT.create({ data: { coletaId: coleta.id, colaboradorId: colaborador.id, ...dados } });
  return { ok: true, saldoJaeCentavos: jae, saldoRiocardCentavos: rio };
}
async function pedirNovaFoto(prisma, saldoId, motivo) {
  const m = texto(motivo, 3, 200); if (!m) return { ok: false, status: 400, erro: 'Explique o que precisa ser refeito (de 3 a 200 letras).' };
  const s = await prisma.saldoVT.findUnique({ where: { id: saldoId } });
  if (!s) return { ok: false, status: 404, erro: 'Saldo não encontrado.' };
  const c = await prisma.coletaVT.findUnique({ where: { id: s.coletaId } });
  if (!c || !c.ativa) return { ok: false, status: 409, erro: 'Esta coleta já foi encerrada.' };
  await prisma.saldoVT.update({ where: { id: saldoId }, data: { status: 'refazer', motivoRefazer: m } });
  return { ok: true, colaboradorId: s.colaboradorId };
}

// ---------- RH
async function resolverAlerta(prisma, colaboradorId, nota, usuario) {
  const reg = await prisma.transporteColaborador.findUnique({ where: { colaboradorId } });
  if (!reg) return { ok: false, status: 404, erro: 'Este colaborador ainda não fez o mapeamento.' };
  await prisma.transporteColaborador.update({ where: { colaboradorId }, data: { alertaResolvidoPor: usuario || null, alertaResolvidoEm: new Date(), alertaNota: texto(nota, 0, 300) || null } });
  return { ok: true };
}
async function reabrirMapeamento(prisma, colaboradorId) {
  const reg = await prisma.transporteColaborador.findUnique({ where: { colaboradorId } });
  if (!reg) return { ok: false, status: 404, erro: 'Este colaborador ainda não fez o mapeamento (ele já pode fazer).' };
  await prisma.transporteColaborador.update({ where: { colaboradorId }, data: { reabertoEm: new Date() } });
  return { ok: true };
}
const alertasVisiveis = (reg) => (reg && lista(reg.alertas).length && !(reg.alertaResolvidoEm && reg.alertaResolvidoEm >= reg.atualizadoEm) ? lista(reg.alertas) : []);

async function listaParaRH(prisma, { loja, busca } = {}) {
  const ativos = await prisma.colaborador.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  const regs = new Map((await prisma.transporteColaborador.findMany()).map((r) => [r.colaboradorId, r]));
  const cSaldo = await coletaAtiva(prisma, 'saldo'); const quando = agoraBR();
  const saldos = new Map(cSaldo ? (await prisma.saldoVT.findMany({ where: { coletaId: cSaldo.id } })).map((s) => [s.colaboradorId, s]) : []);
  const unidades = new Map((await prisma.unidadeTransporte.findMany()).map((u) => [u.loja, u]));
  const b = String(busca || '').trim().toLowerCase();
  const linhas = [];
  for (const c of ativos) {
    if (loja && c.loja !== loja) continue;
    if (b && !String(c.nome).toLowerCase().includes(b)) continue;
    const r = regs.get(c.id); const s = saldos.get(c.id);
    const alertas = r ? [...alertasVisiveis(r)] : ['sem_mapeamento'];
    if (r && r.usaVT && cSaldo && MODALIDADES_COM_CARTAO.includes(r.modalidade)) { if (!s) alertas.push('saldo_pendente'); else if (s.status === 'refazer') alertas.push('saldo_refazer'); }
    const v = r ? valoresDe(r, quando) : null;
    linhas.push({
      id: c.id, nome: c.nome, loja: c.loja, cargo: c.cargo, status: !r ? 'sem_mapeamento' : r.usaVT ? 'mapeado' : 'nao_usa',
      modalidade: r ? r.modalidade : null, modalidadeRotulo: r ? V.MODALIDADES[r.modalidade] || '' : '',
      transportes: r ? [...new Set([...V.nomesDosTransportes(lista(r.transportesJae)), ...V.nomesDosTransportes(lista(r.transportesRiocard))])] : [],
      buiAtivo: r ? r.buiAtivo : null, valorViagem: v ? v.viagem : null, valorDia: v ? v.dia : null, valorMensal: v ? v.mensal : null, alertas,
      saldo: s ? { jaeCentavos: s.saldoJaeCentavos, riocardCentavos: s.saldoRiocardCentavos, informadoEm: s.informadoEm, status: s.status } : null,
      semEnderecoFixo: !!(unidades.get(c.loja) && !unidades.get(c.loja).endereco), atualizadoEm: r ? r.atualizadoEm : null,
    });
  }
  const conta = (f) => linhas.filter(f).length;
  return { linhas, resumo: { ativos: linhas.length, mapeados: conta((l) => l.status === 'mapeado'), naoUsam: conta((l) => l.status === 'nao_usa'), semMapeamento: conta((l) => l.status === 'sem_mapeamento'), bui: conta((l) => l.alertas.includes('bui')), casoDiferente: conta((l) => l.alertas.includes('caso_diferente')), saldoPendente: conta((l) => l.alertas.includes('saldo_pendente')), mensalTotalCentavos: linhas.reduce((n, l) => n + (l.valorMensal || 0), 0), mes: quando.mes, ano: quando.ano, coletaDeSaldo: cSaldo ? { id: cSaldo.id, titulo: cSaldo.titulo, prazo: cSaldo.prazo } : null } };
}

async function detalheParaRH(prisma, colaboradorId) {
  const c = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
  if (!c) return null;
  const [reg, unidade, historico, saldos] = await Promise.all([prisma.transporteColaborador.findUnique({ where: { colaboradorId } }), unidadeDe(prisma, c.loja), prisma.transporteHistorico.findMany({ where: { colaboradorId }, orderBy: { criadoEm: 'desc' }, take: 20 }), prisma.saldoVT.findMany({ where: { colaboradorId }, orderBy: { informadoEm: 'desc' }, take: 12 })]);
  const coletas = new Map((await prisma.coletaVT.findMany({ take: 60 })).map((x) => [x.id, x]));
  return {
    colaborador: { id: c.id, nome: c.nome, cargo: c.cargo, loja: c.loja, cpf: V.formatarCpf(c.matricula) },
    mapeamento: reg ? { usaVT: reg.usaVT, modalidade: reg.modalidade, modalidadeRotulo: V.MODALIDADES[reg.modalidade] || '', jae: lista(reg.transportesJae), riocard: lista(reg.transportesRiocard), numeroRiocard: reg.numeroRiocard, buiAtivo: reg.buiAtivo, casoDiferente: reg.casoDiferente, origem: origemDe(reg), valores: valoresDe(reg), alertas: lista(reg.alertas), alertasAbertos: alertasVisiveis(reg), alertaResolvido: reg.alertaResolvidoEm ? { por: reg.alertaResolvidoPor, em: reg.alertaResolvidoEm, nota: reg.alertaNota } : null, termo: reg.termoAceitoEm ? { aceitoEm: reg.termoAceitoEm } : null, atualizadoEm: reg.atualizadoEm, reaberto: !!(reg.reabertoEm && reg.reabertoEm > reg.atualizadoEm) } : null,
    unidade: unidade ? { loja: unidade.loja, endereco: unidade.endereco, razaoSocial: unidade.razaoSocial, cnpj: unidade.cnpj } : null, links: linksDe(reg, unidade),
    historico: historico.map((h) => ({ id: h.id, motivo: h.motivo, autor: h.autor, em: h.criadoEm, dados: (() => { try { return JSON.parse(h.dados); } catch { return {}; } })() })),
    saldos: saldos.map((s) => ({ id: s.id, coletaId: s.coletaId, coleta: coletas.get(s.coletaId) ? coletas.get(s.coletaId).titulo : '', jaeCentavos: s.saldoJaeCentavos, riocardCentavos: s.saldoRiocardCentavos, anexos: lista(s.anexos), status: s.status, motivoRefazer: s.motivoRefazer, informadoEm: s.informadoEm, coletaAtiva: !!(coletas.get(s.coletaId) && coletas.get(s.coletaId).ativa) })),
  };
}
async function termoDoColaborador(prisma, colaboradorId) {
  const c = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
  const reg = c && (await prisma.transporteColaborador.findUnique({ where: { colaboradorId } }));
  return reg && reg.termoTexto ? { colaborador: c, texto: reg.termoTexto, aceitoEm: reg.termoAceitoEm } : null;
}

// ---------- configuração (valores e unidades)
async function lerConfig(prisma) { return { regras: await lerRegras(prisma), unidades: await prisma.unidadeTransporte.findMany({ orderBy: { loja: 'asc' } }) }; }
async function salvarRegras(prisma, corpo) {
  const campos = [['jae', 'jaeCentavos', 'JAE'], ['riocardUm', 'riocardUmCentavos', 'Riocard (1 transporte)'], ['riocardIntegracao', 'riocardIntegracaoCentavos', 'Riocard (integração)']];
  const dados = {}; const erros = [];
  for (const [k, col, nome] of campos) { const c = V.lerReais(corpo[k]); if (c === null || c < 100 || c > 5000) erros.push(`Valor inválido em "${nome}" (entre R$ 1,00 e R$ 50,00).`); else dados[col] = c; }
  if (erros.length) return { ok: false, status: 400, erros };
  const atual = await prisma.regraVT.findUnique({ where: { id: 'unico' } });
  if (atual) await prisma.regraVT.update({ where: { id: 'unico' }, data: dados }); else await prisma.regraVT.create({ data: { id: 'unico', ...dados } });
  return { ok: true };
}
async function salvarUnidade(prisma, corpo) {
  const loja = texto(corpo.loja, 2, 80); if (!loja) return { ok: false, status: 400, erro: 'Unidade inválida.' };
  const endereco = String(corpo.endereco || '').trim() || null; const cnpjDig = V.soDigitos(corpo.cnpj);
  if (endereco && endereco.length > 200) return { ok: false, status: 400, erro: 'O endereço pode ter no máximo 200 letras.' };
  if (cnpjDig && !cnpjValido(cnpjDig)) return { ok: false, status: 400, erro: 'CNPJ inválido (confira os números).' };
  const dados = { endereco, bairro: texto(corpo.bairro, 0, 80) || null, razaoSocial: texto(corpo.razaoSocial, 0, 120) || null, cnpj: cnpjDig ? V.formatarCnpj(cnpjDig) : null };
  const atual = await prisma.unidadeTransporte.findUnique({ where: { loja } });
  if (atual) await prisma.unidadeTransporte.update({ where: { loja }, data: dados }); else await prisma.unidadeTransporte.create({ data: { loja, ...dados } });
  return { ok: true };
}
function cnpjValido(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = pesos.reduce((t, p, i) => t + p * Number(d[i]), 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

// ---------- Portal do Gestor: uma linha por colaborador, com o valor do mês pedido
async function linhasParaGestor(prisma, { ano, mes, loja, desde } = {}) {
  const hoje = agoraBR(); const a = ano || hoje.ano; const m = mes || hoje.mes;
  const ativos = await prisma.colaborador.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  const regs = new Map((await prisma.transporteColaborador.findMany()).map((r) => [r.colaboradorId, r]));
  const todosSaldos = await prisma.saldoVT.findMany({ orderBy: { informadoEm: 'desc' } });
  const ultimo = new Map(); for (const s of todosSaldos) if (!ultimo.has(s.colaboradorId)) ultimo.set(s.colaboradorId, s);
  const coletas = new Map((await prisma.coletaVT.findMany()).map((x) => [x.id, x]));
  const unidades = new Map((await prisma.unidadeTransporte.findMany()).map((u) => [u.loja, u]));
  const corte = desde ? new Date(desde) : null; const linhas = [];
  for (const c of ativos) {
    if (loja && c.loja !== loja) continue;
    const r = regs.get(c.id); const s = ultimo.get(c.id);
    if (corte && !((r && r.atualizadoEm >= corte) || (s && s.informadoEm >= corte))) continue;
    const jae = r ? lista(r.transportesJae) : []; const rio = r ? lista(r.transportesRiocard) : [];
    const dia = r ? r.valorDiaCentavos : null;
    linhas.push({
      cpf: V.soDigitos(c.matricula), nome: c.nome, loja: c.loja, status: !r ? 'sem_mapeamento' : r.usaVT ? 'mapeado' : 'nao_usa',
      usaVT: r ? r.usaVT : null, modalidade: r ? r.modalidade : null, modalidadeRotulo: r ? V.MODALIDADES[r.modalidade] || null : null,
      transportes: { jae: jae.map((k) => ({ chave: k, rotulo: V.ROTULOS[k] || k })), riocard: rio.map((k) => ({ chave: k, rotulo: V.ROTULOS[k] || k })) },
      buiAtivo: r ? r.buiAtivo : null, alertas: r ? alertasVisiveis(r) : ['sem_mapeamento'],
      valorViagemCentavos: r ? r.valorViagemCentavos : null, valorDiaCentavos: dia, valorMensalCentavos: dia === null || dia === undefined ? null : V.valorMensal(dia, a, m), diasNoMes: V.diasNoMes(a, m),
      bairroOrigem: r ? r.origemBairro : null, unidadeDestino: unidades.get(c.loja) ? unidades.get(c.loja).endereco || null : null,
      ultimoSaldo: s ? { coleta: coletas.get(s.coletaId) ? coletas.get(s.coletaId).titulo : null, jaeCentavos: s.saldoJaeCentavos, riocardCentavos: s.saldoRiocardCentavos, status: s.status, informadoEm: s.informadoEm } : null,
      atualizadoEm: r ? r.atualizadoEm : null,
    });
  }
  return { competencia: `${a}-${String(m).padStart(2, '0')}`, diasNoMes: V.diasNoMes(a, m), viagensPorDia: V.VIAGENS_POR_DIA, geradoEm: new Date().toISOString(), total: linhas.length, colaboradores: linhas };
}

function csvDoRH(linhas, quando = agoraBR()) {
  const cab = ['Nome', 'Unidade', 'Cargo', 'Situação', 'Modalidade', 'Transportes', 'BUI ativo', 'Valor por viagem', 'Valor por dia', `Valor do mês (${String(quando.mes).padStart(2, '0')}/${quando.ano})`, 'Alertas', 'Saldo Jaé', 'Saldo Riocard', 'Saldo informado em', 'Atualizado em'];
  const sit = { mapeado: 'Mapeado', nao_usa: 'Não utiliza', sem_mapeamento: 'Sem mapeamento' };
  const prot = (v) => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };
  const num = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const dt = (d) => (d ? V.dataHoraBR(d) : '');
  const corpo = linhas.map((l) => [l.nome, l.loja, l.cargo, sit[l.status], l.modalidadeRotulo, l.transportes.join(' + '), l.buiAtivo ? V.BUI[l.buiAtivo] || l.buiAtivo : '', num(l.valorViagem), num(l.valorDia), num(l.valorMensal), l.alertas.map((a) => V.ROTULO_ALERTA[a] || a).join(' | '), l.saldo ? num(l.saldo.jaeCentavos) : '', l.saldo ? num(l.saldo.riocardCentavos) : '', l.saldo ? dt(l.saldo.informadoEm) : '', dt(l.atualizadoEm)].map(prot).join(';'));
  return '\uFEFF' + [cab.map(prot).join(';'), ...corpo].join('\r\n') + '\r\n';
}

// endereço sugerido: o da última atualização de dados pessoais dele (a pessoa só confere)
async function enderecoSugerido(prisma, colaboradorId) {
  if (!prisma.atualizacaoDados) return null;
  const u = await prisma.atualizacaoDados.findFirst({ where: { colaboradorId, logradouro: { not: null } }, orderBy: { criadoEm: 'desc' } });
  return u ? { cep: u.cep, logradouro: u.logradouro, numero: u.numero, complemento: u.complemento || '', bairro: u.bairro, cidade: u.cidade, uf: u.uf } : null;
}

module.exports = {
  enderecoSugerido, MAX_TOTAL,
  instalado, lerRegras, lerMapeamento, salvarMapeamento, statusDoColaborador, termoParaLer, criarColeta, encerrarColeta, listarColetas, alvosDaColeta, registrarSaldo, pedirNovaFoto,
  resolverAlerta, reabrirMapeamento, listaParaRH, detalheParaRH, termoDoColaborador, lerConfig, salvarRegras, salvarUnidade, cnpjValido, linhasParaGestor, csvDoRH, agoraBR, competenciaDe, alertasVisiveis, MODALIDADES_COM_CARTAO,
};
