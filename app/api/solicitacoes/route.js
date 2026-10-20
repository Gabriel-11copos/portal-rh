const { prisma } = require('../../../lib/db');
const { getSessaoColaborador, getSessaoRH } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');
const { somarDiasUteis } = require('../../../lib/feriados');
const { escopoSolicitacoes } = require('../../../lib/acesso');
const { modoDeAcesso } = require('../../../lib/contexto');

// Cria uma nova solicitação e aplica a triagem automática com base no assunto:
// define prazo, responsável, e devolve resposta automática se o assunto tiver uma cadastrada.
async function POST(req) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { assuntoId, descricao, anexos, emailContato, whatsapp } = await req.json();

  const assunto = await prisma.assunto.findUnique({ where: { id: assuntoId } });
  if (!assunto) return Response.json({ erro: 'Assunto inválido.' }, { status: 400 });

  const prazo = somarDiasUteis(new Date(), assunto.prazoPadraoDias);

  const solicitacao = await prisma.solicitacao.create({
    data: {
      colaboradorId: sessao.id,
      assuntoId,
      descricao,
      emailContato,
      whatsapp,
      prazo,
      status: assunto.respostaAutomatica ? 'respondida' : 'aberta',
      vistoColaborador: !assunto.respostaAutomatica,
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
  // quem tem os dois logins no mesmo navegador: nas telas do painel vale o RH, nas do colaborador vale o colaborador
  const modo = modoDeAcesso(req, { rh: sessaoRH, colaborador: sessaoColaborador });

  if (modo === 'rh') {
    // quem vê tudo (master, ou com a permissão "Ver todas as solicitações") e quem vê só os assuntos que atende
    const escopo = await escopoSolicitacoes(prisma, sessaoRH);
    if (!escopo.todas && escopo.assuntoIds.length === 0) return Response.json([]);
    const status = url.searchParams.get('status');
    const where = {};
    if (status) where.status = status;
    if (!escopo.todas) where.assuntoId = { in: escopo.assuntoIds };
    const solicitacoes = await prisma.solicitacao.findMany({
      where,
      include: { colaborador: true, assunto: true, respostas: true, anexos: true },
      orderBy: { numero: 'desc' },
    });
    // a senha (criptografada) do colaborador nunca sai do servidor
    return Response.json(solicitacoes.map((s) => {
      if (!s.colaborador) return s;
      const { senhaHash, ...colaborador } = s.colaborador;
      return { ...s, colaborador };
    }));
  }

  if (modo === 'colaborador') {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { colaboradorId: sessaoColaborador.id },
      include: { assunto: true, respostas: true, anexos: true },
      orderBy: { numero: 'desc' },
    });
    return Response.json(solicitacoes);
  }

  return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
}

module.exports = { POST, GET };
