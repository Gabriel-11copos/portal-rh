const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

// Quantos extratos o colaborador tem e quantos ainda não viu (para a bolinha na tela inicial).
async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const [total, naoVistas] = await Promise.all([
    prisma.gorjeta.count({ where: { colaboradorId: sessao.id } }),
    prisma.gorjeta.count({ where: { colaboradorId: sessao.id, vistoColaborador: false } }),
  ]);
  return Response.json({ total, naoVistas });
}

module.exports = { GET };
