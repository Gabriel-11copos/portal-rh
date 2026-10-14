const { iniciarConversa } = require('../../../../../lib/integracao');

// O Portal do Gestor (gestor ou RH) abre uma conversa com um colaborador. Exige a chave da integração.
async function POST(req) {
  return iniciarConversa(req);
}

module.exports = { POST };
