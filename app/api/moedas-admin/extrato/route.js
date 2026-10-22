const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// O extrato de uma pessoa (para o RH conferir o saldo e o que aconteceu).
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    const colaboradorId = new URL(req.url).searchParams.get('colaboradorId');
    if (!colaboradorId) return Response.json({ erro: 'Escolha o colaborador.' }, { status: 400 });
    const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId }, select: { id: true, nome: true, loja: true } });
    if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });
    const [saldo, lancamentos] = await Promise.all([
      M.saldoDe(prisma, colaborador.id),
      prisma.moedaLancamento.findMany({ where: { colaboradorId: colaborador.id }, orderBy: { criadoEm: 'desc' }, take: 100 }),
    ]);
    return Response.json({ colaborador, saldo, extrato: lancamentos.map((l) => ({ ...M.visaoDoLancamento(l), criadoPor: l.criadoPor || null })) });
  } catch (err) {
    console.error('Erro ao carregar o extrato (RH):', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
