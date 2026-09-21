const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

// Conta quantas solicitações do colaborador têm resposta que ele ainda não viu.
async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const count = await prisma.solicitacao.count({
    where: { colaboradorId: sessao.id, vistoColaborador: false },
  });

  return Response.json({ count });
}

module.exports = { GET };
