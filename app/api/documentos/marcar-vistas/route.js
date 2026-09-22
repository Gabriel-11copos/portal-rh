const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

async function POST() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  await prisma.documento.updateMany({
    where: { colaboradorId: sessao.id, vistoColaborador: false },
    data: { vistoColaborador: true },
  });
  return Response.json({ ok: true });
}

module.exports = { POST };
