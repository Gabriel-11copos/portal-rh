const { mensagemDoGestor } = require('../../../../../../../lib/integracao');

// API do Portal do Gestor (exige a chave INTEGRACAO_API_KEY). Ver contrato-integracao-portal-colaborador.md.
async function POST(req, { params }) {
  return mensagemDoGestor(req, params.id);
}

module.exports = { POST };
