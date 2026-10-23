const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const { conferirAtendimento } = require('../../../../../lib/acesso');
const { enviarEmail } = require('../../../../../lib/email');
const { avisarGestor } = require('../../../../../lib/integracao');
const { notificar } = require('../../../../../lib/whatsapp');

async function POST(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const bloqueio = await conferirAtendimento(prisma, sessao, params.id);
  if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });

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

  // WhatsApp: avisa que o pedido foi encerrado (e convida a avaliar)
  await notificar(prisma, { evento: 'solicitacao.encerrada', chave: `encerrada:${id}`, colaborador: solicitacao.colaborador });

  await avisarGestor('solicitacao.encerrada', id);

  return Response.json({ ok: true });
}

module.exports = { POST };
