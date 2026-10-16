const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');
const { hojeBrasilia, estadoDaMissao, lerPedido } = require('../../../../../lib/missoes');

// O colaborador registra que cumpriu uma missão que depende da aprovação do RH.
async function POST(req, { params }) {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const missao = await prisma.missao.findUnique({ where: { id: params.id } });
    if (!missao || !missao.ativo) return Response.json({ erro: 'Missão não encontrada.' }, { status: 404 });
    if (missao.modo !== 'aprovacao') return Response.json({ erro: 'Esta missão se cumpre sozinha, não precisa de pedido.' }, { status: 400 });

    const meus = await prisma.missaoPedido.findMany({ where: { missaoId: missao.id, colaboradorId: sessao.id } });
    const { podeEnviar } = estadoDaMissao(missao, meus, new Set(), hojeBrasilia());
    if (!podeEnviar) return Response.json({ erro: 'Você não pode registrar esta missão agora.' }, { status: 409 });

    const { erros, pedido } = lerPedido(await req.json(), missao);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    const criado = await prisma.missaoPedido.create({
      data: { missaoId: missao.id, colaboradorId: sessao.id, ...pedido, status: 'pendente', vistoColaborador: true },
    });
    return Response.json({ ok: true, id: criado.id });
  } catch (err) {
    console.error('Erro ao registrar pedido de missão:', err);
    return Response.json({ erro: 'Não foi possível registrar agora.' }, { status: 500 });
  }
}

module.exports = { POST };
