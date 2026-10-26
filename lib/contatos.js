// Contatos de WhatsApp dos colaboradores.
// O cadastro de colaborador NÃO tem telefone: o número vem (1) da lista de ativos (coluna de celular), (2) das atualizações de
// dados que o colaborador já fez, e (3) do que ele mesmo confirma no portal. A tabela ContatoColaborador guarda um por pessoa.
//
// Regra de ouro: o número que o PRÓPRIO colaborador confirmou nunca é trocado pela lista de ativos.

const { normalizarTelefone, formatarTelefone } = require('./telefone');

const MSG_TELEFONE = 'Informe um celular válido com DDD (ex.: 21 99999-9999).';
const instalado = (prisma) => !!(prisma && prisma.contatoColaborador);

// ---------- leitura
// Um contato por pessoa; quem ainda não tem registro aproveita o telefone da última atualização de dados que fez (sem gravar nada).
async function ultimosTelefonesDasAtualizacoes(prisma, ids) {
  const mapa = new Map();
  if (!ids.length || !prisma.atualizacaoDados) return mapa;
  const regs = await prisma.atualizacaoDados.findMany({ where: { colaboradorId: { in: ids }, telefone: { not: null } }, orderBy: { criadoEm: 'desc' }, select: { colaboradorId: true, telefone: true } });
  for (const r of regs) { if (mapa.has(r.colaboradorId)) continue; const n = normalizarTelefone(r.telefone); if (n) mapa.set(r.colaboradorId, n); }
  return mapa;
}

// Para o motor de avisos: id -> { telefone (só números, ou null), whatsappAtivo }
async function resolverContatos(prisma, ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const resultado = new Map(unicos.map((id) => [id, { telefone: null, whatsappAtivo: true }]));
  if (!unicos.length) return resultado;
  const conhecidos = new Set();
  if (instalado(prisma)) {
    const linhas = await prisma.contatoColaborador.findMany({ where: { colaboradorId: { in: unicos } } });
    for (const l of linhas) { conhecidos.add(l.colaboradorId); resultado.set(l.colaboradorId, { telefone: l.telefone || null, whatsappAtivo: l.whatsappAtivo !== false }); }
  }
  const sem = unicos.filter((id) => !conhecidos.has(id));
  const dasAtualizacoes = await ultimosTelefonesDasAtualizacoes(prisma, sem);
  for (const [id, tel] of dasAtualizacoes) resultado.set(id, { telefone: tel, whatsappAtivo: true });
  return resultado;
}

// Para a tela do colaborador (o número aparece formatado).
async function contatoParaTela(prisma, colaboradorId) {
  if (!instalado(prisma)) return { disponivel: false };
  const mapa = await resolverContatos(prisma, [colaboradorId]);
  const c = mapa.get(colaboradorId);
  const linha = await prisma.contatoColaborador.findUnique({ where: { colaboradorId } });
  const confirmado = !!(linha && linha.confirmadoEm);
  return { disponivel: true, telefone: c.telefone ? formatarTelefone(c.telefone) : '', whatsappAtivo: c.whatsappAtivo, confirmado, precisaConfirmar: !confirmado };
}

// ---------- gravação
// O colaborador confirma (ou corrige) o próprio número e diz se quer receber os avisos.
async function confirmarContato(prisma, colaboradorId, { telefone, whatsappAtivo }) {
  if (typeof whatsappAtivo !== 'boolean') return { ok: false, status: 400, erro: 'Informe se quer receber os avisos por WhatsApp.' };
  const vazio = telefone == null || String(telefone).trim() === '';
  const numero = vazio ? null : normalizarTelefone(telefone);
  if (!vazio && !numero) return { ok: false, status: 400, erro: MSG_TELEFONE };
  if (vazio && whatsappAtivo) return { ok: false, status: 400, erro: MSG_TELEFONE };
  const agora = new Date();
  await prisma.contatoColaborador.upsert({
    where: { colaboradorId },
    create: { colaboradorId, telefone: numero, origem: 'colaborador', confirmadoEm: agora, whatsappAtivo },
    update: { telefone: numero, origem: 'colaborador', confirmadoEm: agora, whatsappAtivo },
  });
  return { ok: true, telefone: numero ? formatarTelefone(numero) : '', whatsappAtivo };
}

// Só liga ou desliga os avisos (ex.: o colaborador respondeu "SAIR" no WhatsApp). Não mexe no número.
async function definirRecebimento(prisma, colaboradorId, whatsappAtivo) {
  await prisma.contatoColaborador.upsert({
    where: { colaboradorId },
    create: { colaboradorId, telefone: null, origem: 'colaborador', confirmadoEm: null, whatsappAtivo },
    update: { whatsappAtivo },
  });
}

// A lista de ativos trouxe o celular de cada pessoa: vira o contato "pré-programado". Quem já confirmou o próprio número não é alterado.
async function registrarDaLista(prisma, itens, { simular = false } = {}) {
  const r = { novos: 0, atualizados: 0, mantidos: 0, invalidos: 0 };
  if (!instalado(prisma)) return { ...r, instalado: false };
  const validos = [];
  for (const i of itens) {
    const n = normalizarTelefone(i.telefone);
    if (!n) { if (i.telefone) r.invalidos++; continue; }
    if (!i.colaboradorId) { if (simular) r.novos++; continue; }   // na prévia, quem ainda vai ser admitido entra como contato novo
    validos.push({ colaboradorId: i.colaboradorId, telefone: n });
  }
  if (!validos.length) return r;
  const existentes = await prisma.contatoColaborador.findMany({ where: { colaboradorId: { in: validos.map((v) => v.colaboradorId) } } });
  const porId = new Map(existentes.map((e) => [e.colaboradorId, e]));
  const novos = []; const trocas = [];
  for (const v of validos) {
    const e = porId.get(v.colaboradorId);
    if (!e) novos.push({ colaboradorId: v.colaboradorId, telefone: v.telefone, origem: 'lista', confirmadoEm: null, whatsappAtivo: true });
    else if (e.confirmadoEm) r.mantidos++;                       // o próprio colaborador confirmou: a lista não troca
    else if (e.telefone === v.telefone) r.mantidos++;
    else trocas.push(v);
  }
  if (simular) { r.novos += novos.length; r.atualizados = trocas.length; return r; }
  if (novos.length) { const c = await prisma.contatoColaborador.createMany({ data: novos, skipDuplicates: true }); r.novos = c.count; }
  for (let i = 0; i < trocas.length; i += 20) {
    await Promise.all(trocas.slice(i, i + 20).map((t) => prisma.contatoColaborador.update({ where: { colaboradorId: t.colaboradorId }, data: { telefone: t.telefone, origem: 'lista' } })));
  }
  r.atualizados = trocas.length;
  return r;
}

// O colaborador informou o telefone ao responder uma atualização de dados: conta como confirmação.
async function registrarDaAtualizacao(prisma, colaboradorId, telefone) {
  if (!instalado(prisma)) return;
  const n = normalizarTelefone(telefone);
  if (!n) return;
  const atual = await prisma.contatoColaborador.findUnique({ where: { colaboradorId } });
  await prisma.contatoColaborador.upsert({
    where: { colaboradorId },
    create: { colaboradorId, telefone: n, origem: 'colaborador', confirmadoEm: new Date(), whatsappAtivo: true },
    update: { telefone: n, origem: 'colaborador', confirmadoEm: new Date(), whatsappAtivo: atual ? atual.whatsappAtivo : true },
  });
}

// ---------- busca pelo número (usada quando a IA do WhatsApp pergunta "quem é este número?")
async function buscarPorTelefone(prisma, telefone) {
  const n = normalizarTelefone(telefone);
  if (!n || !instalado(prisma)) return [];
  const linhas = await prisma.contatoColaborador.findMany({ where: { telefone: n }, take: 5 });
  if (!linhas.length) return [];
  const pessoas = await prisma.colaborador.findMany({ where: { id: { in: linhas.map((l) => l.colaboradorId) }, ativo: true }, select: { id: true, nome: true, nomeSocial: true, loja: true } });
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  return linhas.filter((l) => porId.has(l.colaboradorId)).map((l) => ({ colaborador: porId.get(l.colaboradorId), contato: l }));
}

// ---------- números para o painel
async function resumoDosContatos(prisma) {
  const ativos = await prisma.colaborador.findMany({ where: { ativo: true }, select: { id: true } });
  const ids = new Set(ativos.map((a) => a.id));
  const linhas = instalado(prisma) ? (await prisma.contatoColaborador.findMany({})).filter((l) => ids.has(l.colaboradorId)) : [];
  const comTelefone = linhas.filter((l) => l.telefone).length;
  return { totalAtivos: ativos.length, comTelefone, semTelefone: ativos.length - comTelefone, confirmados: linhas.filter((l) => l.confirmadoEm).length, naoQuerReceber: linhas.filter((l) => l.whatsappAtivo === false).length };
}

// ---------- exportação da base de ativos
const COLUNAS_EXPORTACAO = ['Nome', 'CPF', 'Loja', 'Cargo', 'E-mail', 'Celular (WhatsApp)', 'Celular confirmado pelo colaborador', 'Confirmado em', 'Recebe avisos no WhatsApp', 'Origem do celular', 'Admissão', 'Nascimento'];

function dataBR(v) { if (!v) return ''; const d = new Date(v); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; }
const ORIGENS = { lista: 'Lista de ativos', atualizacao: 'Atualização de dados', colaborador: 'Informado pelo colaborador' };

async function linhasDaBase(prisma) {
  const pessoas = await prisma.colaborador.findMany({ where: { ativo: true }, select: { id: true, nome: true, matricula: true, loja: true, cargo: true, email: true, dataAdmissao: true, dataNascimento: true }, orderBy: [{ loja: 'asc' }, { nome: 'asc' }] });
  const contatos = instalado(prisma) ? await prisma.contatoColaborador.findMany({ where: { colaboradorId: { in: pessoas.map((p) => p.id) } } }) : [];
  const porId = new Map(contatos.map((c) => [c.colaboradorId, c]));
  const semRegistro = pessoas.filter((p) => !porId.has(p.id)).map((p) => p.id);
  const dasAtualizacoes = await ultimosTelefonesDasAtualizacoes(prisma, semRegistro);
  return pessoas.map((p) => {
    const c = porId.get(p.id);
    const tel = c ? c.telefone : dasAtualizacoes.get(p.id) || null;
    const origem = c ? c.origem : dasAtualizacoes.has(p.id) ? 'atualizacao' : null;
    return [p.nome, p.matricula, p.loja, p.cargo || '', p.email && !String(p.email).endsWith('@sememail.onzecopos.com.br') ? p.email : '', tel ? formatarTelefone(tel) : '', c && c.confirmadoEm ? 'Sim' : 'Não', c && c.confirmadoEm ? dataBR(c.confirmadoEm) : '', c && c.whatsappAtivo === false ? 'Não' : 'Sim', origem ? ORIGENS[origem] || origem : '', dataBR(p.dataAdmissao), dataBR(p.dataNascimento)];
  });
}

// CSV que o Excel brasileiro abre direto: separador ";", acentos corretos (BOM) e aspas protegidas.
// Texto que começa com = + - @ ganha um apóstrofo na frente (evita que o Excel trate como fórmula).
function montarCsv(cabecalho, linhas) {
  const cel = (v) => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return '\uFEFF' + [cabecalho, ...linhas].map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n';
}

module.exports = {
  MSG_TELEFONE, COLUNAS_EXPORTACAO, instalado, resolverContatos, contatoParaTela, confirmarContato, definirRecebimento, registrarDaLista, registrarDaAtualizacao,
  buscarPorTelefone, resumoDosContatos, linhasDaBase, montarCsv, ultimosTelefonesDasAtualizacoes,
};
