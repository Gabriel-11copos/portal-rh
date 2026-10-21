const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const { conferirAtendimento } = require('../../../../../lib/acesso');
const { enviarEmail } = require('../../../../../lib/email');
const { avisarGestor } = require('../../../../../lib/integracao');

async function POST(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const bloqueio = await conferirAtendimento(prisma, sessao, params.id);
  if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });

  const admin = await prisma.adminUsuario.findUnique({ where: { id: sessao.id } });
  const { texto, anexos } = await req.json();
  const { id } = params;

  const respostaCriada = await prisma.resposta.create({
    data: {
      solicitacaoId: id,
      texto,
      autor: 'rh',
      nomeAutor: admin?.nome || 'RH/DP',
      autorFotoUrl: admin?.fotoUrl || null,
      automatica: false,
    },
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
    data: { status: 'respondida', vistoColaborador: false },
    include: { colaborador: true, assunto: true },
  });

  await enviarEmail(
    solicitacao.colaborador.email,
    `Sua solicitação foi respondida: ${solicitacao.assunto.nome}`,
    `<p>Olá ${solicitacao.colaborador.nome}, ${admin?.nome || 'a equipe de RH/DP'} respondeu sua solicitação:</p><p>${texto}</p>
     <p>Acesse o portal para ver os detalhes${anexos?.length ? ' e baixar os documentos anexados' : ''}, e responder se precisar.</p>`
  );

  {
    await avisarGestor('solicitacao.mensagem', id, {
      mensagem: {
        id: respostaCriada.id,
        texto: respostaCriada.texto,
        autor: 'rh',
        nomeAutor: respostaCriada.nomeAutor,
        data: new Date().toISOString(),
        anexos: (anexos || []).map((a) => ({ nome: a.nomeArquivo, link: a.link })),
      },
    });
  }

  return Response.json({ ok: true });
}

module.exports = { POST };
