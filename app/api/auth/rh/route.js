const { prisma } = require('../../../../lib/db');
const { conferirSenha, criarSessaoRH } = require('../../../../lib/auth');

async function POST(req) {
  const { email, senha } = await req.json();

  const usuario = await prisma.adminUsuario.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!usuario) {
    return Response.json({ erro: 'E-mail ou senha inválida.' }, { status: 401 });
  }

  const senhaOk = await conferirSenha(senha, usuario.senhaHash);
  if (!senhaOk) {
    return Response.json({ erro: 'E-mail ou senha inválida.' }, { status: 401 });
  }

  criarSessaoRH(usuario);
  return Response.json({ ok: true });
}

module.exports = { POST };
