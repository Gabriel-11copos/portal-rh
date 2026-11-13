const { prisma } = require('../../../../lib/db');
const E = require('../../../../lib/whatsappEntrada');

// Extrato de gorjeta do colaborador pelo WhatsApp (chave no cabeçalho "Authorization: Bearer ...").
// Corpo: { telefone }. Veja lib/whatsappEntrada.js.
async function POST(req) {
  return E.comEntrada(prisma, req, { confirmado: true }, (ctx) => E.acaoGorjeta(ctx));
}

module.exports = { POST };
