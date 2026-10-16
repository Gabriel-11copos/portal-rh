const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { lerEdicaoMissao } = require('../../../../lib/missoes');

// Só RH: edita uma missão (texto, recompensa, prazo) ou a ativa/desativa.
async function PATCH(req, { params }) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const atual = await prisma.missao.findUnique({ where: { id: params.id } });
    if (!atual) return Response.json({ erro: 'Missão não encontrada.' }, { status: 404 });

    const { saida, erros } = lerEdicaoMissao(await req.json(), atual);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });
    if (Object.keys(saida).length === 0) return Response.json({ erro: 'Nada para alterar.' }, { status: 400 });

    await prisma.missao.update({ where: { id: params.id }, data: saida });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao editar missão:', err);
    return Response.json({ erro: 'Não foi possível salvar a missão.' }, { status: 500 });
  }
}

module.exports = { PATCH };
