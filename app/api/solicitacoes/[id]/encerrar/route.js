const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const { enviarEmail } = require('../../../../../lib/email');

async function POST(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = params;

  const solicitacao = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'encerrada', dataEncerramento: new Date() },
    include: { colaborador: true, assunto: true },
  });

  await enviarEmail(
    solicitacao.colaborador.email,
    `Solicitação encerrada: ${solicitacao.assunto.nome}`,
    `<p>Olá ${solicitacao.colaborador.nome}, sua solicitação sobre <b>${solicitacao.assunto.nome}</b> foi encerrada.</p>`
  );

  return Response.json({ ok: true });
}

module.exports = { POST };
