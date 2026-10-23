const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const W = require('../../../lib/whatsapp');

// Painel do WhatsApp (só master): se a integração está configurada, os números da fila e o histórico recente.
// Nunca devolve a URL do webhook (ela tem um token): só o endereço do site, para conferir se é o certo.
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const base = { configurada: W.ativo(), host: W.hostDoWebhook(), portal: W.baseDoPortal() };
    if (!W.modeloInstalado(prisma)) return Response.json({ ...base, instalada: false });
    const filtro = new URL(req.url).searchParams.get('filtro') || '';
    try {
      const [resumo, itens] = await Promise.all([W.resumoDaFila(prisma), W.listarEnvios(prisma, filtro)]);
      return Response.json({ ...base, instalada: true, resumo, itens });
    } catch (err) {
      if (err && (err.code === 'P2021' || /does not exist/i.test(String(err.message)))) return Response.json({ ...base, instalada: false });
      throw err;
    }
  } catch (err) {
    console.error('Erro no painel do WhatsApp:', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
