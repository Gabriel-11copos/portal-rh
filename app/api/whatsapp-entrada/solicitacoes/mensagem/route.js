const { prisma } = require('../../../../../lib/db');
const E = require('../../../../../lib/whatsappEntrada');

// Chamada da IA do WhatsApp (chave no cabeçalho "Authorization: Bearer ..."). Veja lib/whatsappEntrada.js.
async function POST(req) {
  return E.comEntrada(prisma, req, { confirmado: true }, (ctx) => E.acaoMensagem(prisma, ctx));
}

module.exports = { POST };
