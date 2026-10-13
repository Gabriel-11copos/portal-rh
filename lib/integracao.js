// integracao-portal-gestor v2
const crypto = require('crypto');
const { prisma } = require('./db');
const { enviarEmail } = require('./email');

// Integração com o Portal do Gestor.
//  - Pedidos "do gestor" avisam o Portal do Gestor (aviso assinado com HMAC), com fila de reenvio.
//  - O Portal do Gestor responde por API (chave Bearer): mensagem, status e prazo.
// Contrato completo: contrato-integracao-portal-colaborador.md

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function integracaoAtiva() {
  return !!(process.env.GESTOR_WEBHOOK_URL && process.env.GESTOR_WEBHOOK_SECRET);
}

// Pra onde vai um pedido novo. O assunto manda pro gestor da loja, EXCETO:
//  - o Administrativo (sem gestor definido) -> RH;
//  - enquanto a integração não estiver configurada -> RH (assim nenhum pedido fica sem dono).
function destinoFinal(assunto, loja) {
  if (!integracaoAtiva()) return 'rh';
  if (!assunto || assunto.destino !== 'gestor') return 'rh';
  if (norm(loja).includes('administrativ')) return 'rh';
  return 'gestor';
}

// Vocabulário estável pro outro portal.
function statusExterno(s) {
  return { aberta: 'pendente', em_analise: 'pendente', respondida: 'em_andamento', encerrada: 'encerrada' }[s] || 'pendente';
}

function lerExtras(texto) {
  try {
    return texto ? JSON.parse(texto) : undefined;
  } catch {
    return undefined;
  }
}

function solicitacaoParaAviso(s) {
  const colab = s.colaborador;
  return {
    id: s.id,
    numero: s.numero,
    assunto: s.assunto ? s.assunto.nome : null,
    descricao: s.descricao,
    status: statusExterno(s.status),
    prazo: s.prazo ? new Date(s.prazo).toISOString() : null,
    avaliacaoNota: s.avaliacaoNota || undefined,
    // pedido de atestado: o gestor confere a data e os dias que o colaborador informou
    fluxo: s.assunto && s.assunto.fluxo ? s.assunto.fluxo : undefined,
    dadosExtras: lerExtras(s.dadosExtras),
    colaborador: { cpf: colab.matricula, nome: colab.nomeSocial || colab.nome, loja: colab.loja, cargo: colab.cargo || null },
    contato: { email: s.emailContato || colab.email, whatsapp: s.whatsapp || null },
    anexos: (s.anexos || []).filter((a) => a.enviadoPor === 'colaborador').map((a) => ({ nome: a.nomeArquivo, link: a.linkDrive })),
  };
}

// ---------------- aviso pro Portal do Gestor (com fila) ----------------
const ESPERAS_MIN = [1, 5, 15, 60, 240, 720, 1440];
const MAX_TENTATIVAS = 10;

async function tentarEnvio(reg) {
  let erro = null;
  let definitivo = false;
  try {
    const assinatura = 'sha256=' + crypto.createHmac('sha256', process.env.GESTOR_WEBHOOK_SECRET).update(reg.corpo).digest('hex');
    const res = await fetch(process.env.GESTOR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': assinatura },
      body: reg.corpo,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      erro = 'HTTP ' + res.status;
      definitivo = res.status === 400; // aviso inválido: repetir não adianta
    }
  } catch (e) {
    erro = String(e && e.message ? e.message : e).slice(0, 200);
  }
  if (!erro) {
    await prisma.eventoPendente.update({ where: { id: reg.id }, data: { enviadoEm: new Date(), erro: null } });
    return true;
  }
  const tentativas = reg.tentativas + 1;
  const desistiu = definitivo || tentativas >= MAX_TENTATIVAS;
  const espera = ESPERAS_MIN[Math.min(tentativas - 1, ESPERAS_MIN.length - 1)];
  await prisma.eventoPendente.update({
    where: { id: reg.id },
    data: { tentativas, erro, desistiu, proximaTentativa: new Date(Date.now() + espera * 60000) },
  });
  return false;
}

// Tenta de novo o que ficou na fila (e já pode ser tentado).
async function processarPendentes(limite = 10) {
  if (!integracaoAtiva()) return { enviados: 0, falhas: 0 };
  const devidos = await prisma.eventoPendente.findMany({
    where: { enviadoEm: null, desistiu: false, proximaTentativa: { lte: new Date() } },
    orderBy: { criadoEm: 'asc' },
    take: limite,
  });
  let enviados = 0;
  let falhas = 0;
  for (const reg of devidos) {
    if (await tentarEnvio(reg)) enviados += 1;
    else falhas += 1;
  }
  return { enviados, falhas };
}

/**
 * Avisa o Portal do Gestor. Grava na fila ANTES de enviar: se o envio falhar, o aviso não se perde.
 * Nunca derruba quem chamou (o colaborador não pode ver erro por causa da integração).
 * extra.mensagem = { id, texto, autor, nomeAutor, data, anexos } nos avisos de mensagem.
 */
async function avisarGestor(evento, solicitacaoId, extra = {}) {
  if (!integracaoAtiva()) return;
  try {
    const s = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId }, include: { colaborador: true, assunto: true, anexos: true } });
    if (!s || s.destino !== 'gestor') return;
    const corpo = JSON.stringify({ evento, enviadoEm: new Date().toISOString(), solicitacao: solicitacaoParaAviso(s), ...extra });
    const reg = await prisma.eventoPendente.create({ data: { evento, corpo } });
    await tentarEnvio(reg);
    await processarPendentes(5);
  } catch (e) {
    console.error('[integracao] aviso ao Portal do Gestor falhou (fica na fila):', e);
  }
}

// ---------------- API que o Portal do Gestor chama ----------------
function checarChave(req) {
  const chave = process.env.INTEGRACAO_API_KEY;
  if (!chave) return Response.json({ erro: 'Integração não configurada.' }, { status: 503 });
  const recebido = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(recebido);
  const b = Buffer.from(chave);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return Response.json({ erro: 'Chave inválida.' }, { status: 401 });
  return null;
}

const escapar = (t) => String(t).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

async function carregarDoGestor(req, id) {
  const negado = checarChave(req);
  if (negado) return { resposta: negado };
  const corpo = await req.json().catch(() => null);
  if (!corpo) return { resposta: Response.json({ erro: 'Corpo inválido.' }, { status: 400 }) };
  const s = await prisma.solicitacao.findUnique({ where: { id } });
  if (!s) return { resposta: Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 }) };
  return { corpo, s };
}

// O gerente respondeu.
async function mensagemDoGestor(req, id) {
  const c = await carregarDoGestor(req, id);
  if (c.resposta) return c.resposta;
  const { corpo, s } = c;
  const texto = String(corpo.texto || '').trim();
  const nome = String(corpo.nome || '').trim() || 'Gestor';
  if (!texto) return Response.json({ erro: 'Texto vazio.' }, { status: 400 });
  if (s.destino !== 'gestor') return Response.json({ erro: 'Essa solicitação não é do gestor.' }, { status: 409 });
  if (s.status === 'encerrada') return Response.json({ ok: true, ignorada: 'encerrada' });

  const idExterno = corpo.idExterno ? String(corpo.idExterno) : null;
  if (idExterno) {
    const dup = await prisma.resposta.findFirst({ where: { solicitacaoId: id, idExterno } });
    if (dup) return Response.json({ ok: true, duplicada: true });
  }
  let resposta;
  try {
    resposta = await prisma.resposta.create({ data: { solicitacaoId: id, texto, autor: 'gestor', nomeAutor: nome, automatica: false, idExterno } });
  } catch (e) {
    if (e && e.code === 'P2002') return Response.json({ ok: true, duplicada: true }); // chegou duas vezes ao mesmo tempo
    throw e;
  }
  await prisma.solicitacao.update({ where: { id }, data: { status: 'respondida', vistoColaborador: false } });
  const colab = await prisma.colaborador.findUnique({ where: { id: s.colaboradorId } });
  if (colab) {
    await enviarEmail(colab.email, 'Sua solicitação foi respondida', '<p>Olá ' + escapar(colab.nome) + ', ' + escapar(nome) + ' respondeu sua solicitação:</p><p>' + escapar(texto) + '</p><p>Acesse o portal para ver os detalhes e responder se precisar.</p>');
  }
  await processarPendentes(3).catch(() => {});
  return Response.json({ ok: true, id: resposta.id });
}

// O gerente encerrou (ou voltou pra "em andamento").
async function statusDoGestor(req, id) {
  const c = await carregarDoGestor(req, id);
  if (c.resposta) return c.resposta;
  const { corpo, s } = c;
  if (s.destino !== 'gestor') return Response.json({ erro: 'Essa solicitação não é do gestor.' }, { status: 409 });
  if (corpo.status === 'encerrada') {
    if (s.status !== 'encerrada') {
      await prisma.solicitacao.update({ where: { id }, data: { status: 'encerrada', dataEncerramento: new Date(), vistoColaborador: false } });
    }
  } else if (corpo.status === 'em_andamento') {
    if (s.status !== 'encerrada') await prisma.solicitacao.update({ where: { id }, data: { status: 'respondida' } });
  } else {
    return Response.json({ erro: 'Status inválido (use encerrada ou em_andamento).' }, { status: 400 });
  }
  return Response.json({ ok: true });
}

// O gerente mudou o prazo.
async function prazoDoGestor(req, id) {
  const c = await carregarDoGestor(req, id);
  if (c.resposta) return c.resposta;
  const { corpo, s } = c;
  if (s.destino !== 'gestor') return Response.json({ erro: 'Essa solicitação não é do gestor.' }, { status: 409 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(corpo.novoPrazo || ''))) return Response.json({ erro: 'Prazo inválido (use AAAA-MM-DD).' }, { status: 400 });
  if (s.status !== 'encerrada') {
    await prisma.solicitacao.update({ where: { id }, data: { prazo: new Date(corpo.novoPrazo + 'T12:00:00') } });
  }
  return Response.json({ ok: true });
}

module.exports = { integracaoAtiva, destinoFinal, avisarGestor, processarPendentes, mensagemDoGestor, statusDoGestor, prazoDoGestor };
