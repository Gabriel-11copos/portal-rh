const { prisma } = require('../../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../../lib/auth');

// Edita um usuário do RH/DP (nome, e-mail, foto, e opcionalmente redefine a senha).
async function PATCH(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = params;
  const { nome, email, fotoUrl, novaSenha } = await req.json();

  const dados = {};
  if (nome !== undefined) dados.nome = nome;
  if (email !== undefined) dados.email = email.toLowerCase().trim();
  if (fotoUrl !== undefined) dados.fotoUrl = fotoUrl;
  if (novaSenha) dados.senhaHash = await gerarHash(novaSenha);

  const usuario = await prisma.adminUsuario.update({ where: { id }, data: dados });
  const { senhaHash, ...dadosPublicos } = usuario;
  return Response.json(dadosPublicos);
}

module.exports = { PATCH };
