const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');

// RH define um novo prazo (ex: para evitar que uma solicitação fique marcada como
// atrasada). Isso também move a solicitação para "em andamento", sinalizando que
// está sendo ativamente cuidada com uma nova data prevista.
async function POST(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { novoPrazo } = await req.json();
  const { id } = params;

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });
  if (!solicitacao) return Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  if (solicitacao.status === 'encerrada') {
    return Response.json({ erro: 'Não é possível alterar o prazo de uma solicitação encerrada.' }, { status: 400 });
  }

  const atualizada = await prisma.solicitacao.update({
    where: { id },
    data: { prazo: new Date(novoPrazo), status: 'respondida' },
  });

  return Response.json({ ok: true, solicitacao: atualizada });
}

module.exports = { POST };
