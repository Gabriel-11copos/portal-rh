const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const { enviarEmail } = require('../../../../../lib/email');

async function POST(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { texto, anexos } = await req.json();
  const { id } = params;

  await prisma.resposta.create({
    data: { solicitacaoId: id, texto, automatica: false },
  });

  if (anexos?.length) {
    await prisma.anexo.createMany({
      data: anexos.map((a) => ({
        solicitacaoId: id,
        linkDrive: a.link,
        nomeArquivo: a.nomeArquivo,
        enviadoPor: 'rh',
      })),
    });
  }

  const solicitacao = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'respondida' },
    include: { colaborador: true, assunto: true },
  });

  await enviarEmail(
    solicitacao.colaborador.email,
    `Sua solicitação foi respondida: ${solicitacao.assunto.nome}`,
    `<p>Olá ${solicitacao.colaborador.nome}, sua solicitação recebeu uma resposta:</p><p>${texto}</p>
     <p>Acesse o portal para ver os detalhes${anexos?.length ? ' e baixar os documentos anexados' : ''}.</p>`
  );

  return Response.json({ ok: true });
}

module.exports = { POST };
