const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');

// O colaborador recebe só os próprios extratos de gorjeta (sempre filtrado pela sessão).
async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const extratos = await prisma.gorjeta.findMany({
    where: { colaboradorId: sessao.id },
    orderBy: [{ periodoInicio: 'desc' }, { unidade: 'asc' }],
  });
  return Response.json(extratos);
}

module.exports = { GET };
