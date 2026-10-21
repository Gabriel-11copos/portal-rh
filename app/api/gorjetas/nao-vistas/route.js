const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

// Quantos extratos o colaborador tem e quantos ainda não viu (para a bolinha na tela inicial).
async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const [total, naoVistas, ultimo] = await Promise.all([
    prisma.gorjeta.count({ where: { colaboradorId: sessao.id } }),
    prisma.gorjeta.count({ where: { colaboradorId: sessao.id, vistoColaborador: false } }),
    prisma.gorjeta.findFirst({ where: { colaboradorId: sessao.id }, orderBy: { periodoInicio: 'desc' }, select: { situacao: true } }),
  ]);
  // "parcial": o extrato mais recente ainda não foi fechado (os valores podem mudar)
  return Response.json({ total, naoVistas, parcial: !!ultimo && ultimo.situacao !== 'fechado' });
}

module.exports = { GET };
