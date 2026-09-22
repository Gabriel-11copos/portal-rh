const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const count = await prisma.documento.count({
    where: { colaboradorId: sessao.id, vistoColaborador: false },
  });
  return Response.json({ count });
}

module.exports = { GET };
