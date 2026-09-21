const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

// Marca todas as solicitações do colaborador como vistas (chamado ao abrir a lista).
async function POST() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  await prisma.solicitacao.updateMany({
    where: { colaboradorId: sessao.id, vistoColaborador: false },
    data: { vistoColaborador: true },
  });

  return Response.json({ ok: true });
}

module.exports = { POST };
