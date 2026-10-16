const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

// Tira a bolinha de "novidade" das decisões que o colaborador já viu.
async function POST() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    await prisma.missaoPedido.updateMany({
      where: { colaboradorId: sessao.id, vistoColaborador: false },
      data: { vistoColaborador: true },
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao marcar missões como vistas:', err);
    return Response.json({ ok: false });
  }
}

module.exports = { POST };
