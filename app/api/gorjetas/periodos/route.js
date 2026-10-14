const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Lista os períodos já publicados (resumo por unidade e período).
async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const grupos = await prisma.gorjeta.groupBy({
    by: ['unidade', 'periodoInicio', 'periodoFim', 'situacao'],
    _count: { _all: true },
    _sum: { liquida: true },
    _max: { atualizadoEm: true },
    orderBy: [{ periodoInicio: 'desc' }, { unidade: 'asc' }],
  });

  return Response.json(
    grupos.map((g) => ({
      unidade: g.unidade,
      periodoInicio: g.periodoInicio,
      periodoFim: g.periodoFim,
      situacao: g.situacao,
      pessoas: g._count._all,
      somaLiquida: g._sum.liquida || 0,
      atualizadoEm: g._max.atualizadoEm,
    }))
  );
}

// Despublica um período inteiro (apaga os extratos daquela unidade e início).
async function DELETE(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { unidade, periodoInicio } = await req.json();
  const inicio = new Date(`${String(periodoInicio || '').slice(0, 10)}T00:00:00.000Z`);
  if (!unidade || isNaN(inicio)) return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });

  const r = await prisma.gorjeta.deleteMany({ where: { unidade, periodoInicio: inicio } });
  return Response.json({ ok: true, removidos: r.count });
}

module.exports = { GET, DELETE };
