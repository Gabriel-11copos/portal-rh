const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');

// Lista assuntos: colaborador vê só os ativos (formulário de nova solicitação);
// RH vê todos, inclusive inativos, para poder reativar se precisar.
async function GET() {
  const sessao = getSessaoRH();
  const assuntos = await prisma.assunto.findMany({
    where: sessao ? {} : { ativo: true },
    orderBy: { nome: 'asc' },
  });
  return Response.json(assuntos);
}

// RH cria um novo assunto/categoria.
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica } = await req.json();

  const assunto = await prisma.assunto.create({
    data: { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica },
  });

  return Response.json(assunto);
}

module.exports = { GET, POST };
