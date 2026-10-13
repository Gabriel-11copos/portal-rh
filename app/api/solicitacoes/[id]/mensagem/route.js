const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');
const { avisarGestor } = require('../../../../../lib/integracao');

async function POST(req, { params }) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { texto, anexos } = await req.json();
  const { id } = params;

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });
  if (!solicitacao || solicitacao.colaboradorId !== sessao.id) {
    return Response.json({ erro: 'Solicitação não encontrada.' }, { status: 404 });
  }
  if (solicitacao.status === 'encerrada') {
    return Response.json({ erro: 'Esta solicitação já foi encerrada.' }, { status: 400 });
  }

  let respostaCriada = null;
  if (texto && texto.trim()) {
    respostaCriada = await prisma.resposta.create({
      data: {
        solicitacaoId: id,
        texto,
        autor: 'colaborador',
        nomeAutor: sessao.nome,
        automatica: false,
      },
    });
  }

  if (anexos?.length) {
    await prisma.anexo.createMany({
      data: anexos.map((a) => ({
        solicitacaoId: id,
        linkDrive: a.link,
        nomeArquivo: a.nomeArquivo,
        enviadoPor: 'colaborador',
      })),
    });
  }

  const atualizada = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'em_analise', vistoColaborador: true },
    include: { assunto: true, colaborador: true },
  });

  if (atualizada.destino === 'gestor') {
    await avisarGestor('solicitacao.mensagem', id, {
      mensagem: {
        id: respostaCriada ? respostaCriada.id : 'a-' + Date.now(),
        texto: respostaCriada ? respostaCriada.texto : '',
        autor: 'colaborador',
        nomeAutor: sessao.nome,
        data: new Date().toISOString(),
        anexos: (anexos || []).map((a) => ({ nome: a.nomeArquivo, link: a.link })),
      },
    });
  }

  return Response.json({ ok: true, solicitacao: atualizada });
}

module.exports = { POST };
