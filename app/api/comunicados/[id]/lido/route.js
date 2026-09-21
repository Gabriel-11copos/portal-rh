const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');

async function POST(req, { params }) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = params;
  const comunicado = await prisma.comunicado.findUnique({ where: { id } });
  if (!comunicado || comunicado.colaboradorId !== sessao.id) {
    return Response.json({ erro: 'Comunicado não encontrado.' }, { status: 404 });
  }

  await prisma.comunicado.update({
    where: { id },
    data: { lido: true, lidoEm: new Date() },
  });

  return Response.json({ ok: true });
}

module.exports = { POST };
