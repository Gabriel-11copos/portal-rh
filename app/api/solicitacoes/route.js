const { prisma } = require('../../../lib/db');
const { getSessaoColaborador, getSessaoRH } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');

// Cria uma nova solicitação e aplica a triagem automática com base no assunto:
// define prazo, responsável, e devolve resposta automática se o assunto tiver uma cadastrada.
async function POST(req) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { assuntoId, descricao, anexos } = await req.json();

  const assunto = await prisma.assunto.findUnique({ where: { id: assuntoId } });
  if (!assunto) return Response.json({ erro: 'Assunto inválido.' }, { status: 400 });

  const prazo = new Date();
  prazo.setDate(prazo.getDate() + assunto.prazoPadraoDias);

  const solicitacao = await prisma.solicitacao.create({
    data: {
      colaboradorId: sessao.id,
      assuntoId,
      descricao,
      prazo,
      status: assunto.respostaAutomatica ? 'respondida' : 'aberta',
      anexos: {
        create: (anexos || []).map((a) => ({
          linkDrive: a.link,
          nomeArquivo: a.nomeArquivo,
          enviadoPor: 'colaborador',
        })),
      },
    },
  });

  // Triagem automática: se o assunto já tem resposta padrão configurada, responde na hora.
  if (assunto.respostaAutomatica) {
    await prisma.resposta.create({
      data: {
        solicitacaoId: solicitacao.id,
        texto: assunto.respostaAutomatica,
        automatica: true,
      },
    });
  }

  const colaborador = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
  await enviarEmail(
    colaborador.email,
    `Solicitação recebida: ${assunto.nome}`,
    `<p>Olá ${colaborador.nome}, recebemos sua solicitação sobre <b>${assunto.nome}</b>.</p>
     ${assunto.respostaAutomatica ? `<p>${assunto.respostaAutomatica}</p>` : '<p>Ela será analisada pela nossa equipe em breve.</p>'}`
  );

  return Response.json({ ok: true, id: solicitacao.id });
}

// Lista solicitações: do colaborador logado, ou todas (para o RH, com filtros opcionais).
async function GET(req) {
  const url = new URL(req.url);
  const sessaoColaborador = getSessaoColaborador();
  const sessaoRH = getSessaoRH();

  if (sessaoRH) {
    const status = url.searchParams.get('status');
    const solicitacoes = await prisma.solicitacao.findMany({
      where: status ? { status } : {},
      include: { colaborador: true, assunto: true, respostas: true, anexos: true },
      orderBy: { dataAbertura: 'desc' },
    });
    return Response.json(solicitacoes);
  }

  if (sessaoColaborador) {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { colaboradorId: sessaoColaborador.id },
      include: { assunto: true, respostas: true, anexos: true },
      orderBy: { dataAbertura: 'desc' },
    });
    return Response.json(solicitacoes);
  }

  return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
}

module.exports = { POST, GET };
