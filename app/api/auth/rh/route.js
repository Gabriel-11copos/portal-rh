const { prisma } = require('../../../../lib/db');
const { conferirSenha, criarSessaoRH } = require('../../../../lib/auth');
const { carregarAcesso } = require('../../../../lib/acesso');

async function POST(req) {
  let corpo = {};
  try { corpo = await req.json(); } catch { /* corpo vazio ou inválido */ }
  const email = typeof corpo.email === 'string' ? corpo.email.toLowerCase().trim() : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
  if (!email || !senha) {
    return Response.json({ erro: 'E-mail ou senha inválida.' }, { status: 401 });
  }

  const usuario = await prisma.adminUsuario.findUnique({ where: { email } });
  if (!usuario) {
    return Response.json({ erro: 'E-mail ou senha inválida.' }, { status: 401 });
  }

  const senhaOk = await conferirSenha(senha, usuario.senhaHash);
  if (!senhaOk) {
    return Response.json({ erro: 'E-mail ou senha inválida.' }, { status: 401 });
  }

  // o que esta pessoa pode fazer no painel (master, personalizado ou sem acesso)
  let acesso;
  try {
    acesso = await carregarAcesso(prisma, usuario.id);
  } catch (err) {
    console.error('Erro ao consultar as permissões no login:', err);
    return Response.json({ erro: 'Não foi possível entrar agora. Tente de novo.' }, { status: 500 });
  }
  if (acesso.perfil === 'sem_acesso') {
    return Response.json({ erro: 'Seu usuário ainda não tem acesso ao painel. Fale com quem administra o portal.' }, { status: 403 });
  }

  criarSessaoRH(usuario, acesso);
  return Response.json({ ok: true });
}

module.exports = { POST };
