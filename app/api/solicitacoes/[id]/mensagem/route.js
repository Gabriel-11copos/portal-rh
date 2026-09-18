const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');
const { enviarEmail } = require('../../../../../lib/email');

async function POST(req, { params }) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { texto } = await req.json();
  const { id } = params;

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });
  if (!solicitacao || solicitacao.colaboradorId !== sessao.id) {
    return Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }
  if (solicitacao.status === 'encerrada') {
    return Response.json({ erro: 'Esta solicitação já foi encerrada.' }, { status: 400 });
  }

  await prisma.resposta.create({
    data: {
      solicitacaoId: id,
      texto,
      autor: 'colaborador',
      nomeAutor: sessao.nome,
      automatica: false,
    },
  });

  // Volta para "em análise" para sinalizar ao RH que precisa olhar de novo.
  const atualizada = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'em_analise' },
    include: { assunto: true, colaborador: true },
  });

  return Response.json({ ok: true, solicitacao: atualizada });
}

module.exports = { POST };
