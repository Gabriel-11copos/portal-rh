const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');

// Lista todos os assuntos ativos (usado tanto no formulário do colaborador quanto no admin).
async function GET() {
  const assuntos = await prisma.assunto.findMany({
    where: { ativo: true },
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
