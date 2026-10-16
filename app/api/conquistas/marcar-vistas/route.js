const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

async function POST() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    await prisma.seloConcedido.updateMany({
      where: { colaboradorId: sessao.id, vistoColaborador: false },
      data: { vistoColaborador: true },
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao marcar selos como vistos:', err);
    return Response.json({ ok: false });
  }
}

module.exports = { POST };
