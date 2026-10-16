const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Só RH. Últimas concessões (para conferir e corrigir) e remoção de uma concessão feita por engano.
async function GET() {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const grants = await prisma.seloConcedido.findMany({ orderBy: { criadoEm: 'desc' }, take: 60 });
    if (grants.length === 0) return Response.json([]);

    const [colabs, selos] = await Promise.all([
      prisma.colaborador.findMany({
        where: { id: { in: [...new Set(grants.map((g) => g.colaboradorId))] } },
        select: { id: true, nome: true, nomeSocial: true, loja: true },
      }),
      prisma.selo.findMany({ where: { id: { in: [...new Set(grants.map((g) => g.seloId))] } } }),
    ]);
    const cPorId = new Map(colabs.map((c) => [c.id, c]));
    const sPorId = new Map(selos.map((s) => [s.id, s]));

    return Response.json(
      grants.map((g) => ({
        id: g.id,
        colaborador: cPorId.has(g.colaboradorId) ? (cPorId.get(g.colaboradorId).nomeSocial || cPorId.get(g.colaboradorId).nome) : '(removido)',
        loja: cPorId.has(g.colaboradorId) ? cPorId.get(g.colaboradorId).loja : null,
        selo: sPorId.has(g.seloId) ? sPorId.get(g.seloId).nome : '(selo removido)',
        icone: sPorId.has(g.seloId) ? sPorId.get(g.seloId).icone : '',
        data: g.data,
        periodoRef: g.periodoRef,
        concedidoPor: g.concedidoPor,
        visto: g.vistoColaborador,
      }))
    );
  } catch (err) {
    console.error('Erro ao listar concessões:', err);
    return Response.json({ erro: 'Não foi possível carregar as concessões.' }, { status: 500 });
  }
}

async function DELETE(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const { id } = await req.json();
    if (typeof id !== 'string' || !id) return Response.json({ erro: 'Concessão inválida.' }, { status: 400 });
    const r = await prisma.seloConcedido.deleteMany({ where: { id } });
    return Response.json({ ok: true, removidos: r.count });
  } catch (err) {
    console.error('Erro ao remover concessão:', err);
    return Response.json({ erro: 'Não foi possível remover.' }, { status: 500 });
  }
}

module.exports = { GET, DELETE };
