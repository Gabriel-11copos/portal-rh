const { prisma } = require('../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../lib/auth');

// RH cadastra um colaborador com matrícula/senha inicial (colaborador pode trocar depois, se quiser essa tela no futuro).
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, matricula, email, loja, senha } = await req.json();
  const senhaHash = await gerarHash(senha);

  const colaborador = await prisma.colaborador.create({
    data: { nome, matricula, email, loja, senhaHash },
  });

  return Response.json({ ok: true, id: colaborador.id });
}

async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const colaboradores = await prisma.colaborador.findMany({ orderBy: { nome: 'asc' } });
  return Response.json(colaboradores);
}

module.exports = { POST, GET };
