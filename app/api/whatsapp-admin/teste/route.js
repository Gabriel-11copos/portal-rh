const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const W = require('../../../../lib/whatsapp');

// Manda UMA mensagem de teste para o número que o master digitar, e mostra o que o webhook respondeu.
// Serve para conferir a integração e para a plataforma de WhatsApp "ver" o formato do corpo.
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo !== 'object') return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
    const r = await W.enviarTeste(prisma, corpo);
    if (r.status === 400 && !r.enviado) return Response.json({ erro: r.erro }, { status: 400 });
    return Response.json({ ok: r.ok, httpStatus: r.httpStatus, erro: r.erro, resposta: r.resposta, enviado: r.enviado });
  } catch (err) {
    console.error('Erro no teste do WhatsApp:', err && err.code);
    return Response.json({ erro: 'Não foi possível enviar o teste agora.' }, { status: 500 });
  }
}

module.exports = { POST };
