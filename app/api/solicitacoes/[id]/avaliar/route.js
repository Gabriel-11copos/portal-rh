const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');
const { avisarGestor } = require('../../../../../lib/integracao');

async function POST(req, { params }) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nota } = await req.json();
  const { id } = params;

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });
  if (!solicitacao || solicitacao.colaboradorId !== sessao.id) {
    return Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }

  const atualizadaAv = await prisma.solicitacao.update({
    where: { id },
    data: {
      status: 'encerrada',
      dataEncerramento: new Date(),
      avaliacaoNota: nota || null,
    },
  });

  {
    await avisarGestor('solicitacao.encerrada', id);
    await avisarGestor('solicitacao.avaliada', id);
  }

  return Response.json({ ok: true });
}

module.exports = { POST };
