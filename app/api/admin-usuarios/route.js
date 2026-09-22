const { prisma } = require('../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../lib/auth');

// Lista os usuários do RH/DP (sem expor a senha).
async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const usuarios = await prisma.adminUsuario.findMany({
    select: { id: true, nome: true, email: true, fotoUrl: true, criadoEm: true },
    orderBy: { nome: 'asc' },
  });
  return Response.json(usuarios);
}

// Cria um novo usuário do RH/DP (ex: a Dani), com nome, e-mail e senha próprios.
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, email, senha } = await req.json();
  const senhaHash = await gerarHash(senha);

  const usuario = await prisma.adminUsuario.create({
    data: { nome, email: email.toLowerCase().trim(), senhaHash },
  });

  return Response.json({ ok: true, id: usuario.id });
}

module.exports = { GET, POST };
