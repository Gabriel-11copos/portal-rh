const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const W = require('../../../../lib/whatsapp');

// Envia o que está esperando na fila (um pedaço por vez, dentro do limite de tempo). Com { reenviarFalhas: true},
// antes volta para a fila o que tinha falhado de vez (ex.: quando o webhook estava errado e já foi corrigido).
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!W.modeloInstalado(prisma)) return Response.json({ erro: 'As tabelas do WhatsApp ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    if (!W.ativo()) return Response.json({ erro: 'O webhook ainda não está configurado (falta a variável WHATSAPP_WEBHOOK_URL no Vercel).' }, { status: 409 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const reenviadas = corpo && corpo.reenviarFalhas === true ? await W.reenviarFalhas(prisma) : 0;
    const r = await W.processarFila(prisma, { limite: 20, orcamentoMs: 4000 });
    return Response.json({ ok: true, reenviadas, ...r });
  } catch (err) {
    console.error('Erro ao processar a fila do WhatsApp:', err && err.code);
    return Response.json({ erro: 'Não foi possível processar agora.' }, { status: 500 });
  }
}

module.exports = { POST };
