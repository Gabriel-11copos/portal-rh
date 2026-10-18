const { prisma } = require('../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../lib/auth');
const { conferirMaster } = require('../../../lib/acesso');
const { validarSenha } = require('../../../lib/senhas');

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

  // só o master cria usuários (conferido no banco)
  const bloqueio = await conferirMaster(prisma, sessao);
  if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });

  const { nome, email, senha } = await req.json();
  if (typeof nome !== 'string' || nome.trim().length < 2) return Response.json({ erro: 'Informe o nome.' }, { status: 400 });
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) return Response.json({ erro: 'Informe um e-mail válido.' }, { status: 400 });
  const erroSenha = validarSenha(senha);
  if (erroSenha) return Response.json({ erro: erroSenha.replace('a nova senha', 'a senha') }, { status: 400 });
  const senhaHash = await gerarHash(senha);

  try {
    const usuario = await prisma.adminUsuario.create({
      data: { nome: nome.trim(), email: email.toLowerCase().trim(), senhaHash },
    });
    return Response.json({ ok: true, id: usuario.id });
  } catch (err) {
    if (err && err.code === 'P2002') return Response.json({ erro: 'Já existe um usuário com este e-mail.' }, { status: 409 });
    console.error('Erro ao criar usuário:', err);
    return Response.json({ erro: 'Não foi possível criar agora.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
