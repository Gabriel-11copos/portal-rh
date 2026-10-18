const { prisma } = require('../../../../lib/db');
const { getSessaoRH, gerarHash, conferirSenha } = require('../../../../lib/auth');
const { validarSenha } = require('../../../../lib/senhas');

// Dados do próprio usuário RH logado (para a tela "Meu perfil" dele).
async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const usuario = await prisma.adminUsuario.findUnique({ where: { id: sessao.id } });
  if (!usuario) return Response.json({ erro: 'Usuário não encontrado.' }, { status: 404 });

  const { senhaHash, ...dadosPublicos } = usuario;
  return Response.json(dadosPublicos);
}

// Muda nome, foto e (se informar a senha atual) a senha do próprio usuário.
async function PATCH(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { nome, fotoUrl, novaSenha, senhaAtual } = await req.json();
    const dados = {};
    if (nome !== undefined) dados.nome = nome;
    if (fotoUrl !== undefined) dados.fotoUrl = fotoUrl;

    if (novaSenha !== undefined && novaSenha !== null && novaSenha !== '') {
      const erroSenha = validarSenha(novaSenha);
      if (erroSenha) return Response.json({ erro: erroSenha }, { status: 400 });
      const atual = await prisma.adminUsuario.findUnique({ where: { id: sessao.id }, select: { senhaHash: true } });
      if (!atual) return Response.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
      // pede a senha atual: quem pegar um computador logado não consegue "roubar" a conta trocando a senha
      if (typeof senhaAtual !== 'string' || !senhaAtual || !(await conferirSenha(senhaAtual, atual.senhaHash))) {
        return Response.json({ erro: 'A senha atual não confere.' }, { status: 403 });
      }
      dados.senhaHash = await gerarHash(novaSenha);
    }

    const usuario = await prisma.adminUsuario.update({ where: { id: sessao.id }, data: dados });
    const { senhaHash, ...dadosPublicos } = usuario;
    return Response.json(dadosPublicos);
  } catch (err) {
    console.error('Erro ao atualizar o perfil:', err);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { GET, PATCH };
