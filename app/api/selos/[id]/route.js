const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { lerCamposDoSelo } = require('../../../../lib/selos');

// Só RH. Edita nome, descrição e ícone, ou ativa e desativa um selo.
// Desativar esconde o selo na hora de conceder, mas quem já ganhou continua com ele.
async function PATCH(req, { params }) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const corpo = await req.json();
    const { saida, erros } = lerCamposDoSelo(corpo, true);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });
    if (corpo.ativo !== undefined) saida.ativo = !!corpo.ativo;
    if (Object.keys(saida).length === 0) return Response.json({ erro: 'Nada para alterar.' }, { status: 400 });

    const existe = await prisma.selo.findUnique({ where: { id: params.id } });
    if (!existe) return Response.json({ erro: 'Selo não encontrado.' }, { status: 404 });

    return Response.json(await prisma.selo.update({ where: { id: params.id }, data: saida }));
  } catch (err) {
    console.error('Erro ao editar selo:', err);
    return Response.json({ erro: 'Não foi possível salvar o selo.' }, { status: 500 });
  }
}

module.exports = { PATCH };
