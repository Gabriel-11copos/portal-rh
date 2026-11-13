const { prisma } = require('../../../../lib/db');
const E = require('../../../../lib/whatsappEntrada');

// Escala do colaborador pelo WhatsApp (chave no cabeçalho "Authorization: Bearer ...").
// Corpo: { telefone, inicio?, dias? }. Veja lib/whatsappEntrada.js.
async function POST(req) {
  return E.comEntrada(prisma, req, { confirmado: true }, (ctx) => E.acaoEscala(ctx));
}

module.exports = { POST };
