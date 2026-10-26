const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const W = require('../../../lib/whatsapp');
const { resumoDosContatos } = require('../../../lib/contatos');
const { entradaAtiva } = require('../../../lib/whatsappEntrada');

// Painel do WhatsApp (só master): se a integração está configurada, os números da fila e o histórico recente.
// Nunca devolve a URL do webhook (ela tem um token): só o endereço do site, para conferir se é o certo.
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    // entrada: a conversa pelo WhatsApp (abrir e acompanhar pedidos) está ligada? (só diz sim/não: a chave nunca sai do servidor)
    const base = { configurada: W.ativo(), host: W.hostDoWebhook(), portal: W.baseDoPortal(), entrada: entradaAtiva() };
    if (!W.modeloInstalado(prisma)) return Response.json({ ...base, instalada: false });
    const filtro = new URL(req.url).searchParams.get('filtro') || '';
    try {
      const [resumo, itens, contatos] = await Promise.all([W.resumoDaFila(prisma), W.listarEnvios(prisma, filtro), resumoDosContatos(prisma).catch(() => null)]);
      return Response.json({ ...base, instalada: true, resumo, itens, contatos });
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
