const { prisma } = require('../../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../../lib/auth');

// Dados do próprio usuário RH logado (para a tela "Meu perfil" dele).
async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const usuario = await prisma.adminUsuario.findUnique({ where: { id: sessao.id } });
  if (!usuario) return Response.json({ erro: 'Usuário não encontrado.' }, { status: 404 });

  const { senhaHash, ...dadosPublicos } = usuario;
  return Response.json(dadosPublicos);
}

async function PATCH(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, fotoUrl, novaSenha } = await req.json();
  const dados = {};
  if (nome !== undefined) dados.nome = nome;
  if (fotoUrl !== undefined) dados.fotoUrl = fotoUrl;
  if (novaSenha) dados.senhaHash = await gerarHash(novaSenha);

  const usuario = await prisma.adminUsuario.update({ where: { id: sessao.id }, data: dados });
  const { senhaHash, ...dadosPublicos } = usuario;
  return Response.json(dadosPublicos);
}

module.exports = { GET, PATCH };
