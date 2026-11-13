// A IA do WhatsApp conversando com o portal: identificar o colaborador pelo número, abrir pedido, acompanhar, escrever no pedido,
// ver comunicados e pedir para parar de receber avisos.
//
// Segurança (resumo):
//  - toda chamada leva a chave secreta no cabeçalho (variável WHATSAPP_ENTRADA_CHAVE no Vercel, no mínimo 24 caracteres);
//  - o colaborador é identificado pelo número do WhatsApp, que precisa estar no cadastro de contatos de UMA pessoa ativa;
//  - para abrir pedido, ler respostas ou escrever, o número precisa ter sido CONFIRMADO pelo próprio colaborador no portal;
//  - só o que é dele: pedidos e comunicados de outra pessoa nunca aparecem; nunca sai CPF, e-mail ou senha;
//  - limites por hora (pedidos e mensagens) contra abuso. Toda resposta traz "mensagem" em português para a IA repassar.

const crypto = require('crypto');
const C = require('./contatos');
const { normalizarTelefone } = require('./telefone');
const { abrirSolicitacao, adicionarMensagemDoColaborador } = require('./pedidos');
const { baseDoPortal, primeiroNome, limpar } = require('./whatsapp');
const { normalizaCpf, escalaLiberadaPara, montarSemana } = require('./escalas');

const MIN_CHAVE = 24;
const LIMITES = { pedidosPorHora: 5, mensagensPorHora: 20 };
const STATUS = { aberta: 'Aberta', em_analise: 'Em análise', respondida: 'Respondida', encerrada: 'Encerrada' };

const responder = (status, corpo) => Response.json(corpo, { status });
const falhar = (status, erro, mensagem, extra = {}) => responder(status, { ok: false, erro, mensagem, ...extra });

const chaveConfigurada = () => String(process.env.WHATSAPP_ENTRADA_CHAVE || '').trim();
const entradaAtiva = () => chaveConfigurada().length >= MIN_CHAVE;

// Compara a chave sem dar pista pelo tempo de resposta.
function autorizado(req) {
  const esperada = chaveConfigurada();
  if (esperada.length < MIN_CHAVE) return false;
  const m = String(req.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
}

// Quem é o dono deste número?
async function identificar(prisma, telefone, exigirConfirmado) {
  const numero = normalizarTelefone(telefone);
  if (!numero) return { ok: false, status: 400, erro: 'telefone_invalido', mensagem: 'O telefone precisa ser um celular com DDD.' };
  if (!C.instalado(prisma)) return { ok: false, status: 503, erro: 'contatos_indisponiveis', mensagem: 'O cadastro de contatos ainda não está disponível.' };
  const achados = await C.buscarPorTelefone(prisma, numero);
  if (achados.length === 0) return { ok: false, status: 404, erro: 'nao_encontrado', mensagem: 'Não encontrei este número no cadastro de colaboradores ativos.' };
  if (achados.length > 1) return { ok: false, status: 409, erro: 'telefone_compartilhado', mensagem: 'Este número está cadastrado para mais de uma pessoa. Cada uma precisa atualizar o próprio número em Meu perfil, no portal.' };
  const { colaborador, contato } = achados[0];
  if (exigirConfirmado && !contato.confirmadoEm) {
    return { ok: false, status: 403, erro: 'contato_nao_confirmado', mensagem: 'Para conversar com o GGC pelo WhatsApp, entre no portal e confirme o seu número (a janela aparece no primeiro acesso, ou em Meu perfil).', extra: { link: `${baseDoPortal()}/perfil` } };
  }
  return { ok: true, colaborador, contato, numero };
}

// Envolve cada rota: chave -> corpo -> quem é -> a ação. Qualquer erro vira uma resposta curta, sem detalhes internos.
async function comEntrada(prisma, req, { confirmado = true } = {}, acao) {
  try {
    if (!entradaAtiva()) return falhar(503, 'entrada_desligada', 'A conversa pelo WhatsApp ainda não está ativada no portal.');
    if (!autorizado(req)) return falhar(401, 'nao_autorizado', 'Chave inválida.');
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return falhar(400, 'json_invalido', 'Envie um JSON com o telefone.');
    const quem = await identificar(prisma, corpo.telefone, confirmado);
    if (!quem.ok) return falhar(quem.status, quem.erro, quem.mensagem, quem.extra);
    return await acao({ ...quem, corpo });
  } catch (err) {
    console.error('WhatsApp (entrada): erro inesperado', err && err.code);
    return falhar(500, 'erro_interno', 'Não consegui atender agora. Tente de novo em instantes.');
  }
}

const registrar = (acao, colaboradorId) => console.log(`[whatsapp-entrada] ${acao} colaborador=${colaboradorId}`);
const umaHoraAtras = () => new Date(Date.now() - 3600 * 1000);
const textoLimpo = (t, min, max) => { const x = String(t == null ? '' : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim(); return x.length >= min && x.length <= max ? x : null; };
const cortar = (t, n) => { const x = String(t || ''); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };

// ---------- ações
async function acaoIdentificar({ colaborador, contato }) {
  return responder(200, { ok: true, colaborador: { primeiroNome: primeiroNome(colaborador), unidade: colaborador.loja }, confirmado: !!contato.confirmadoEm, querReceberAvisos: contato.whatsappAtivo !== false });
}

async function acaoAssuntos(prisma) {
  const assuntos = await prisma.assunto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  return responder(200, { ok: true, assuntos: assuntos.map((a) => ({ id: a.id, nome: a.nome, prazoDias: a.prazoPadraoDias, respostaImediata: !!a.respostaAutomatica, peloWhatsapp: a.fluxo === 'padrao' })), linkPortal: `${baseDoPortal()}/nova-solicitacao`, mensagem: 'Os assuntos com peloWhatsapp=false (ex.: atestado, uniforme) precisam de anexo ou dados extras e só podem ser abertos no portal.' });
}

async function acaoAbrir(prisma, { colaborador, numero, corpo }) {
  const descricao = textoLimpo(corpo.descricao, 5, 2000);
  if (typeof corpo.assuntoId !== 'string' || !corpo.assuntoId) return falhar(400, 'assunto_invalido', 'Escolha o assunto da solicitação.');
  if (!descricao) return falhar(400, 'descricao_invalida', 'Descreva a solicitação (de 5 a 2000 letras).');
  const assunto = await prisma.assunto.findUnique({ where: { id: corpo.assuntoId } });
  if (!assunto || !assunto.ativo) return falhar(404, 'assunto_invalido', 'Este assunto não existe ou não está disponível.');
  if (assunto.fluxo !== 'padrao') return falhar(422, 'assunto_so_no_portal', `O assunto "${assunto.nome}" precisa de anexo ou dados extras. Abra pelo portal.`, { link: `${baseDoPortal()}/nova-solicitacao` });
  const recentes = await prisma.solicitacao.count({ where: { colaboradorId: colaborador.id, dataAbertura: { gte: umaHoraAtras() } } });
  if (recentes >= LIMITES.pedidosPorHora) return falhar(429, 'muitos_pedidos', 'Você já abriu várias solicitações na última hora. Espere um pouco ou acompanhe as que estão abertas.');
  const completo = await prisma.colaborador.findUnique({ where: { id: colaborador.id } });
  const emailReal = completo.email && !String(completo.email).endsWith('@sememail.onzecopos.com.br') ? completo.email : null;
  const pedido = await abrirSolicitacao(prisma, { colaborador: completo, assunto, descricao, anexos: [], emailContato: emailReal, whatsapp: numero, avisarWhatsapp: false });
  registrar('abrir', colaborador.id);
  return responder(201, { ok: true, id: pedido.id, numero: pedido.numero, assunto: assunto.nome, status: pedido.status, statusRotulo: STATUS[pedido.status] || pedido.status, prazo: pedido.prazo, respostaAutomatica: assunto.respostaAutomatica || null, link: `${baseDoPortal()}/minhas-solicitacoes`, mensagem: `Solicitação nº ${pedido.numero} aberta.` });
}

function rotuloDoAutor(r) { return r.automatica ? 'Resposta automática' : r.autor === 'colaborador' ? 'Você' : 'GGC'; }

async function acaoListar(prisma, { colaborador, corpo }) {
  const limite = Math.min(10, Math.max(1, Number.isInteger(corpo.limite) ? corpo.limite : 5));
  const pedidos = await prisma.solicitacao.findMany({ where: { colaboradorId: colaborador.id }, orderBy: { dataAbertura: 'desc' }, take: limite, include: { assunto: true, respostas: true } });
  registrar('listar', colaborador.id);
  return responder(200, {
    ok: true,
    solicitacoes: pedidos.map((s) => {
      const ultima = [...s.respostas].sort((a, b) => new Date(b.data) - new Date(a.data))[0];
      return { id: s.id, numero: s.numero, assunto: s.assunto ? s.assunto.nome : '', status: s.status, statusRotulo: STATUS[s.status] || s.status, abertoEm: s.dataAbertura, prazo: s.prazo, encerradoEm: s.dataEncerramento || null, ultimaMensagem: ultima ? { de: rotuloDoAutor(ultima), texto: cortar(ultima.texto, 700), em: ultima.data } : null };
    }),
    link: `${baseDoPortal()}/minhas-solicitacoes`,
  });
}

async function acaoMensagem(prisma, { colaborador, corpo }) {
  const texto = textoLimpo(corpo.texto, 2, 2000);
  if (!texto) return falhar(400, 'texto_invalido', 'Escreva a mensagem (de 2 a 2000 letras).');
  const alvo = Number.isInteger(corpo.numero) ? { colaboradorId: colaborador.id, numero: corpo.numero } : typeof corpo.solicitacaoId === 'string' ? { colaboradorId: colaborador.id, id: corpo.solicitacaoId } : null;
  if (!alvo) return falhar(400, 'pedido_invalido', 'Informe o número da solicitação.');
  const pedido = await prisma.solicitacao.findFirst({ where: alvo });
  if (!pedido) return falhar(404, 'pedido_nao_encontrado', 'Não achei esta solicitação entre as suas.');
  const enviadas = await prisma.resposta.count({ where: { autor: 'colaborador', data: { gte: umaHoraAtras() }, solicitacao: { colaboradorId: colaborador.id } } });
  if (enviadas >= LIMITES.mensagensPorHora) return falhar(429, 'muitas_mensagens', 'Você já mandou várias mensagens na última hora. Espere um pouco.');
  const r = await adicionarMensagemDoColaborador(prisma, { colaborador: { id: colaborador.id, nome: colaborador.nome }, solicitacaoId: pedido.id, texto, anexos: [] });
  if (!r.ok) return r.status === 400 ? falhar(409, 'pedido_encerrado', 'Esta solicitação já foi encerrada. Abra uma nova se precisar.') : falhar(r.status, 'pedido_nao_encontrado', r.erro);
  registrar('mensagem', colaborador.id);
  return responder(200, { ok: true, numero: pedido.numero, status: 'em_analise', statusRotulo: STATUS.em_analise, mensagem: 'Mensagem enviada ao GGC.' });
}

async function acaoComunicados(prisma, { colaborador, corpo }) {
  const limite = Math.min(5, Math.max(1, Number.isInteger(corpo.limite) ? corpo.limite : 3));
  const lista = await prisma.comunicado.findMany({ where: { colaboradorId: colaborador.id }, orderBy: { data: 'desc' }, take: limite });
  registrar('comunicados', colaborador.id);
  return responder(200, { ok: true, comunicados: lista.map((c) => ({ assunto: c.assunto, texto: cortar(c.texto, 700), em: c.data, lido: !!c.lido })), link: `${baseDoPortal()}/comunicados` });
}

async function acaoPreferencias(prisma, { colaborador, corpo }) {
  if (typeof corpo.receberAvisos !== 'boolean') return falhar(400, 'valor_invalido', 'Informe receberAvisos como verdadeiro ou falso.');
  await C.definirRecebimento(prisma, colaborador.id, corpo.receberAvisos);
  registrar(corpo.receberAvisos ? 'voltou-a-receber' : 'parou-de-receber', colaborador.id);
  return responder(200, { ok: true, receberAvisos: corpo.receberAvisos, mensagem: corpo.receberAvisos ? 'Pronto, você volta a receber os avisos do GGC por WhatsApp.' : 'Pronto, você não vai mais receber avisos do GGC por WhatsApp. Para voltar, é só pedir aqui.' });
}

// Escala do colaborador pelo WhatsApp. Usa a mesma montagem da tela do portal.
// Parâmetros opcionais no corpo: inicio (AAAA-MM-DD, padrão hoje) e dias (1 a 7, padrão 7).
async function acaoEscala({ colaborador, corpo }) {
  const cpf = normalizaCpf(colaborador.matricula);
  if (!cpf) return responder(200, { ok: true, liberada: false, mensagem: 'A sua escala ainda não está disponível. Fale com o GGC.' });
  if (!escalaLiberadaPara(cpf)) return responder(200, { ok: true, liberada: false, mensagem: 'A sua escala ainda não foi liberada.' });
  try {
    const semana = await montarSemana({ cpf, inicio: corpo && corpo.inicio, dias: corpo && corpo.dias });
    // monta um texto pronto para a IA mandar, além dos dados crus
    const dias = (semana.dias || []).map((d) => {
      const turnos = (d.itens || []).map((t) => {
        const horario = t.entrada && t.saida ? `${t.entrada} às ${t.saida}` : (t.entrada || t.saida || null);
        return { horario, loja: t.lojaNome || null, cargo: t.cargo || null };
      });
      return { data: d.data, trabalha: turnos.length > 0, turnos };
    });
    return responder(200, { ok: true, liberada: true, inicio: semana.inicio, dias });
  } catch (err) {
    console.error('[whatsapp-entrada] escala falhou:', err && err.message);
    return responder(503, { ok: false, erro: 'escala_indisponivel', mensagem: 'Não consegui consultar a escala agora. Tente de novo em instantes.' });
  }
}

// Extrato de gorjeta do colaborador pelo WhatsApp. Devolve o período mais recente de cada unidade.
// Valores em centavos (ex.: 12345 = R$ 123,45).
async function acaoGorjeta({ colaborador }) {
  const extratos = await prisma.gorjeta.findMany({
    where: { colaboradorId: colaborador.id },
    orderBy: [{ periodoInicio: 'desc' }, { unidade: 'asc' }],
    take: 12,
  });
  if (extratos.length === 0) return responder(200, { ok: true, temExtrato: false, mensagem: 'Você ainda não tem extrato de gorjeta disponível.' });
  // só o período mais recente (pode ter mais de uma unidade no mesmo período)
  const maisRecente = extratos[0].periodoInicio.getTime();
  const doPeriodo = extratos.filter((e) => e.periodoInicio.getTime() === maisRecente);
  const iso = (d) => d.toISOString().slice(0, 10);
  // "fechado" = valores finais; qualquer outro = parcial (ainda em apuração, pode mudar)
  const parcial = doPeriodo.some((e) => e.situacao !== 'fechado');
  const itens = doPeriodo.map((e) => {
    const ehParcial = e.situacao !== 'fechado';
    return {
      unidade: e.unidade,
      valorLiquidoCentavos: e.liquida,
      situacao: ehParcial ? 'parcial' : 'fechado',
      // enquanto parcial, atrasos/faltas ainda estão sendo apurados: não mostrar como definitivo
      atrasos: ehParcial ? null : e.atrasosQtd,
      faltas: ehParcial ? null : e.faltasQtd,
      apuracaoPendente: ehParcial,
    };
  });
  const aviso = parcial
    ? 'Este período ainda está EM APURAÇÃO. O valor é parcial e pode mudar: atrasos, faltas e redistribuição ainda estão sendo apurados. O valor final sai quando o período for fechado.'
    : 'Período fechado: estes são os valores finais.';
  return responder(200, { ok: true, temExtrato: true, periodoInicio: iso(doPeriodo[0].periodoInicio), periodoFim: iso(doPeriodo[0].periodoFim), parcial, aviso, itens });
}

module.exports = { MIN_CHAVE, LIMITES, STATUS, entradaAtiva, autorizado, identificar, comEntrada, acaoIdentificar, acaoAssuntos, acaoAbrir, acaoListar, acaoMensagem, acaoComunicados, acaoPreferencias, acaoEscala, acaoGorjeta };
