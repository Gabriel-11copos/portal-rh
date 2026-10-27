// Avisos por WhatsApp. O portal manda cada aviso para o webhook da plataforma de WhatsApp/IA contratada
// (variável WHATSAPP_WEBHOOK_URL no Vercel: a URL tem um token, por isso NUNCA vai para o código nem para o log).
//
// O corpo é SEMPRE no mesmo formato: { nome, telefone, unidade, mensagem, link }  ("link" vazio quando não há).
// Só vai texto genérico + link do portal: nada de valores, CPF ou o conteúdo de respostas (isso fica no portal, com login).
//
// Cada aviso é gravado numa fila ANTES de ser enviado: se o webhook falhar, tenta de novo (com espera crescente) e o RH
// vê o histórico em "WhatsApp" no painel. Nunca derruba quem chamou (o colaborador não pode ver erro por causa do WhatsApp).

const { normalizarTelefone, mascarar } = require('./telefone');
const { resolverContatos } = require('./contatos');

const TIMEOUT_MS = 4000;
const ESPERAS_MIN = [1, 5, 15, 60, 240, 720, 1440];
const MAX_TENTATIVAS = 8;
const RESERVA_MIN = 3;                       // enquanto uma execução envia, as outras não repetem o mesmo aviso
const SEM_TELEFONE = 'Sem telefone válido no cadastro';
const BASE_PADRAO = 'https://colaboradorbrew.vercel.app';
const STATUS_DEFINITIVOS = [400, 401, 403, 404, 410, 413, 422];   // repetir não adianta (aviso inválido ou webhook errado)

// ---------- configuração
function urlDoWebhook() {
  const u = String(process.env.WHATSAPP_WEBHOOK_URL || '').trim();
  return /^https:\/\/[^\s]+$/.test(u) ? u : null;
}
const ativo = () => !!urlDoWebhook();
function hostDoWebhook() {
  try { return new URL(urlDoWebhook()).host; } catch { return null; }
}
function baseDoPortal() {
  const b = String(process.env.PORTAL_URL || BASE_PADRAO).trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s]+$/.test(b) ? b : BASE_PADRAO;
}
const modeloInstalado = (prisma) => !!(prisma && prisma.whatsappEnvio);

// ---------- limpeza dos textos
function limpar(valor, max = 80) {
  return String(valor == null ? '' : valor).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function capitalizar(t) {
  const s = limpar(t, 40).toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function primeiroNome(colaborador) {
  return capitalizar(String(colaborador.nomeSocial || colaborador.nome || '').trim().split(/\s+/)[0]) || 'colaborador';
}

// (as funções de telefone ficam em lib/telefone.js, as mesmas que a lista de ativos e a tela de contato usam)

// ---------- os avisos: o texto e para onde o link leva (um lugar só, fácil de ajustar)
const EVENTOS = {
  'solicitacao.criada': { caminho: '/minhas-solicitacoes', texto: (d) => `Olá, ${d.nome}! Recebemos a sua solicitação${d.numero ? ` nº ${d.numero}` : ''}. Você vai ser avisado aqui quando ela for respondida.` },
  'atualizacao.liberada': { caminho: '/atualizar-dados', texto: (d) => `Olá, ${d.nome}! O RH liberou a atualização dos seus dados (telefone, e-mail e endereço). Faça pelo portal quando puder.` },
  'solicitacao.respondida': { caminho: '/minhas-solicitacoes', texto: (d) => `Olá, ${d.nome}! Respondemos a sua solicitação. Veja a resposta no portal.` },
  'solicitacao.encerrada': { caminho: '/minhas-solicitacoes', texto: (d) => `Olá, ${d.nome}! A sua solicitação foi encerrada. Se puder, avalie o atendimento no portal.` },
  'solicitacao.mensagem': { caminho: '/minhas-solicitacoes', texto: (d) => `Olá, ${d.nome}! Você recebeu uma nova mensagem sobre a sua solicitação. Acesse o portal para ver e responder.` },
  'comunicado.novo': { caminho: '/comunicados', texto: (d) => `Olá, ${d.nome}! Você tem um novo comunicado do RH${d.assunto ? `: "${d.assunto}"` : ''}. Leia no portal.` },
  'documento.disponivel': { caminho: '/documentos', texto: (d) => `Olá, ${d.nome}! O seu documento "${d.documento}" já está disponível no portal.` },
  'gorjeta.disponivel': { caminho: '/gorjeta', texto: (d) => `Olá, ${d.nome}! O seu extrato de gorjeta (${d.periodo}) já está no portal.${d.parcial ? ' Atenção: os valores são parciais e podem mudar até o fechamento.' : ''}` },
  'gorjeta.fechada': { caminho: '/gorjeta', texto: (d) => `Olá, ${d.nome}! O extrato de gorjeta (${d.periodo}) foi fechado. Confira no portal.` },
  'missao.aprovada': { caminho: '/missoes', texto: (d) => `Olá, ${d.nome}! A sua missão "${d.titulo}" foi aprovada. 🎉 Veja no portal.` },
  'missao.recusada': { caminho: '/missoes', texto: (d) => `Olá, ${d.nome}! A sua missão "${d.titulo}" não foi aprovada desta vez. Veja o motivo no portal.` },
  'troca.entregue': { caminho: '/missoes/carteira', texto: (d) => `Olá, ${d.nome}! A sua troca "${d.premio}" foi entregue.` },
  'troca.recusada': { caminho: '/missoes/carteira', texto: (d) => `Olá, ${d.nome}! A sua troca "${d.premio}" não pôde ser concluída e as moedas voltaram para o seu saldo.` },
  'selo.recebido': { caminho: '/conquistas', texto: (d) => `Olá, ${d.nome}! Você recebeu o selo "${d.selo}"! 🏅 Veja no portal.` },
};

// "20/10 a 31/10" (datas de calendário ficam guardadas à meia-noite UTC)
function periodoBR(inicio, fim) {
  const f = (v) => { const d = new Date(v); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  return `${f(inicio)} a ${f(fim)}`;
}

// O corpo que vai para o webhook: SEMPRE estas 5 chaves, nesta ordem.
function montarCorpo({ nome, telefone, unidade, mensagem, link }) {
  return { nome: limpar(nome, 120), telefone: telefone || '', unidade: limpar(unidade, 80), mensagem: limpar(mensagem, 600), link: link || '' };
}

function corpoDoAviso(colaborador, evento, dados, telefone) {
  const modelo = EVENTOS[evento];
  if (!modelo) return null;
  const limpos = {};
  for (const [k, v] of Object.entries(dados || {})) limpos[k] = typeof v === 'boolean' ? v : limpar(v, 80);
  const mensagem = modelo.texto({ ...limpos, nome: primeiroNome(colaborador) });
  return montarCorpo({
    nome: colaborador.nomeSocial || colaborador.nome,
    telefone: telefone || '',
    unidade: colaborador.loja,
    mensagem,
    link: `${baseDoPortal()}${modelo.caminho}`,
  });
}

// ---------- o envio
function semSegredo(texto) {
  const url = urlDoWebhook();
  let t = String(texto == null ? '' : texto);
  if (url) t = t.split(url).join('[webhook]');
  return t.replace(/[a-f0-9]{24,}/gi, '[...]').slice(0, 200);
}

async function postar(corpoJson) {
  const url = urlDoWebhook();
  if (!url) return { ok: false, status: 0, erro: 'Webhook não configurado.', definitivo: false };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpoJson, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    const resposta = semSegredo(await res.text().catch(() => '')).slice(0, 300);
    if (res.ok) return { ok: true, status: res.status, resposta };
    return { ok: false, status: res.status, erro: `HTTP ${res.status}`, resposta, definitivo: STATUS_DEFINITIVOS.includes(res.status) };
  } catch (e) {
    return { ok: false, status: 0, erro: semSegredo(e && e.message ? e.message : e) || 'Falha de conexão', definitivo: false };
  }
}

async function tentarEnvio(prisma, reg) {
  const agora = new Date();
  // reserva o aviso (só uma execução por vez envia o mesmo): evita mensagem repetida
  const reservou = await prisma.whatsappEnvio.updateMany({
    where: { id: reg.id, enviadoEm: null, desistiu: false, proximaTentativa: { lte: agora } },
    data: { proximaTentativa: new Date(agora.getTime() + RESERVA_MIN * 60000) },
  });
  if (reservou.count === 0) return null;
  const r = await postar(reg.corpo);
  const tentativas = reg.tentativas + 1;
  if (r.ok) {
    await prisma.whatsappEnvio.update({ where: { id: reg.id }, data: { enviadoEm: new Date(), erro: null, tentativas } });
    return true;
  }
  const desistiu = !!r.definitivo || tentativas >= MAX_TENTATIVAS;
  const espera = ESPERAS_MIN[Math.min(tentativas - 1, ESPERAS_MIN.length - 1)];
  await prisma.whatsappEnvio.update({ where: { id: reg.id }, data: { tentativas, erro: r.erro, desistiu, proximaTentativa: new Date(Date.now() + espera * 60000) } });
  return false;
}

const DEVIDOS = () => ({ enviadoEm: null, desistiu: false, proximaTentativa: { lte: new Date() } });

// Envia o que está na fila e já pode ser tentado, até o orçamento de tempo acabar (o resto fica para a próxima).
async function processarFila(prisma, { limite = 10, orcamentoMs = 4000, concorrencia = 4 } = {}) {
  if (!ativo() || !modeloInstalado(prisma)) return { enviados: 0, falhas: 0, restantes: 0 };
  try {
    const inicio = Date.now();
    const devidos = await prisma.whatsappEnvio.findMany({ where: DEVIDOS(), orderBy: { criadoEm: 'asc' }, take: limite });
    let enviados = 0; let falhas = 0;
    for (let i = 0; i < devidos.length; i += concorrencia) {
      if (Date.now() - inicio > orcamentoMs) break;
      const resultados = await Promise.all(devidos.slice(i, i + concorrencia).map((r) => tentarEnvio(prisma, r)));
      enviados += resultados.filter((x) => x === true).length;
      falhas += resultados.filter((x) => x === false).length;
    }
    return { enviados, falhas, restantes: await prisma.whatsappEnvio.count({ where: DEVIDOS() }) };
  } catch (err) {
    console.error('WhatsApp: erro ao processar a fila', err && err.code);
    return { enviados: 0, falhas: 0, restantes: 0 };
  }
}

// ---------- o que o resto do portal usa
// item: { evento, chave, colaborador | colaboradorId, dados }.  "chave" evita aviso repetido (o mesmo fato nunca avisa duas vezes).
async function notificarLote(prisma, itens, { limite = 40 } = {}) {
  try {
    if (!ativo() || !modeloInstalado(prisma) || !Array.isArray(itens) || itens.length === 0) return { enfileirados: 0 };
    const faltam = [...new Set(itens.filter((i) => !i.colaborador && i.colaboradorId).map((i) => i.colaboradorId))];
    const porId = new Map();
    if (faltam.length) {
      const lidos = await prisma.colaborador.findMany({ where: { id: { in: faltam } }, select: { id: true, nome: true, nomeSocial: true, loja: true, ativo: true } });
      lidos.forEach((c) => porId.set(c.id, c));
    }
    // o cadastro não tem telefone: o número vem dos contatos (lista de ativos, atualizações de dados, confirmação do colaborador)
    const contatos = await resolverContatos(prisma, itens.map((i) => (i.colaborador ? i.colaborador.id : i.colaboradorId)));
    const linhas = [];
    for (const item of itens) {
      const c = item.colaborador || porId.get(item.colaboradorId);
      if (!c || c.ativo === false) continue;                       // quem saiu da empresa não recebe aviso
      const contato = contatos.get(c.id) || { telefone: null, whatsappAtivo: true };
      if (contato.whatsappAtivo === false) continue;               // pediu para não receber avisos por WhatsApp
      const corpo = corpoDoAviso(c, item.evento, item.dados, contato.telefone);
      if (!corpo) { console.error('WhatsApp: aviso desconhecido', item.evento); continue; }
      const semTelefone = !corpo.telefone;
      linhas.push({ evento: item.evento, chave: item.chave || null, corpo: JSON.stringify(corpo), desistiu: semTelefone, erro: semTelefone ? SEM_TELEFONE : null });
    }
    if (linhas.length === 0) return { enfileirados: 0 };
    const r = await prisma.whatsappEnvio.createMany({ data: linhas, skipDuplicates: true });
    await processarFila(prisma, { limite });
    return { enfileirados: r && typeof r.count === 'number' ? r.count : linhas.length };
  } catch (err) {
    if (!(err && (err.code === 'P2021' || /does not exist/i.test(String(err.message))))) console.error('WhatsApp: não foi possível avisar', err && err.code);
    return { enfileirados: 0 };
  }
}

const notificar = (prisma, item) => notificarLote(prisma, [item], { limite: 5 });

// ---------- painel do RH (só master)
const rotuloDoStatus = (r) => (r.enviadoEm ? 'enviado' : r.erro === SEM_TELEFONE ? 'sem-telefone' : r.desistiu ? 'falhou' : 'pendente');

function visaoDoEnvio(r) {
  let c = {};
  try { c = JSON.parse(r.corpo); } catch { c = {}; }
  return { id: r.id, evento: r.evento, status: rotuloDoStatus(r), tentativas: r.tentativas, erro: r.erro || null, criadoEm: r.criadoEm, enviadoEm: r.enviadoEm || null, nome: c.nome || '', unidade: c.unidade || '', telefone: mascarar(c.telefone), mensagem: c.mensagem || '', link: c.link || '' };
}

async function resumoDaFila(prisma) {
  const ontem = new Date(Date.now() - 24 * 3600 * 1000);
  const [enviados24h, pendentes, desistidos, semTelefone] = await Promise.all([
    prisma.whatsappEnvio.count({ where: { enviadoEm: { gte: ontem } } }),
    prisma.whatsappEnvio.count({ where: { enviadoEm: null, desistiu: false } }),
    prisma.whatsappEnvio.count({ where: { enviadoEm: null, desistiu: true } }),
    prisma.whatsappEnvio.count({ where: { enviadoEm: null, desistiu: true, erro: SEM_TELEFONE } }),
  ]);
  return { enviados24h, pendentes, falhas: desistidos - semTelefone, semTelefone };
}

const FILTROS = {
  pendentes: () => ({ enviadoEm: null, desistiu: false }),
  falhas: () => ({ enviadoEm: null, desistiu: true, erro: { not: SEM_TELEFONE } }),
  semtelefone: () => ({ enviadoEm: null, desistiu: true, erro: SEM_TELEFONE }),
  enviados: () => ({ enviadoEm: { not: null } }),
};
async function listarEnvios(prisma, filtro, limite = 60) {
  const where = FILTROS[filtro] ? FILTROS[filtro]() : {};
  const regs = await prisma.whatsappEnvio.findMany({ where, orderBy: { criadoEm: 'desc' }, take: limite });
  return regs.map(visaoDoEnvio);
}

// Volta para a fila o que falhou de vez (ex.: o webhook estava errado e já foi corrigido). Não mexe em "sem telefone" nem nos testes.
async function reenviarFalhas(prisma) {
  const r = await prisma.whatsappEnvio.updateMany({
    where: { enviadoEm: null, desistiu: true, erro: { not: SEM_TELEFONE }, evento: { not: 'teste' } },
    data: { desistiu: false, tentativas: 0, erro: null, proximaTentativa: new Date() },
  });
  return r.count;
}

// Envio de teste (o RH escolhe o número). Não entra na fila de tentativas: mostra na hora o que o webhook respondeu.
async function enviarTeste(prisma, entrada) {
  if (!ativo()) return { ok: false, status: 400, erro: 'O webhook ainda não está configurado (falta a variável WHATSAPP_WEBHOOK_URL no Vercel).' };
  const telefone = normalizarTelefone(entrada && entrada.telefone);
  if (!telefone) return { ok: false, status: 400, erro: 'Informe um celular válido com DDD (ex.: 21 99999-9999).' };
  const nome = limpar(entrada.nome, 120) || 'Teste do Portal';
  const mensagem = limpar(entrada.mensagem, 600);
  if (mensagem.length < 3) return { ok: false, status: 400, erro: 'Escreva a mensagem de teste.' };
  const link = String(entrada.link || '').trim();
  if (link && !/^https:\/\/[^\s]+$/.test(link)) return { ok: false, status: 400, erro: 'O link precisa começar com https://' };
  const corpo = JSON.stringify(montarCorpo({ nome, telefone, unidade: entrada.unidade, mensagem, link }));
  const r = await postar(corpo);
  if (modeloInstalado(prisma)) {
    try { await prisma.whatsappEnvio.create({ data: { evento: 'teste', corpo, tentativas: 1, enviadoEm: r.ok ? new Date() : null, desistiu: !r.ok, erro: r.ok ? null : r.erro } }); }
    catch (err) { console.error('WhatsApp: não foi possível registrar o teste', err && err.code); }
  }
  return { ok: r.ok, status: r.status || 502, httpStatus: r.status, erro: r.ok ? null : r.erro, resposta: r.resposta || '', enviado: JSON.parse(corpo) };
}

module.exports = {
  TIMEOUT_MS, ESPERAS_MIN, MAX_TENTATIVAS, SEM_TELEFONE, EVENTOS,
  ativo, hostDoWebhook, baseDoPortal, modeloInstalado, limpar, primeiroNome, normalizarTelefone, mascarar, periodoBR, montarCorpo, corpoDoAviso,
  postar, tentarEnvio, processarFila, notificarLote, notificar, visaoDoEnvio, resumoDaFila, listarEnvios, reenviarFalhas, enviarTeste,
};
