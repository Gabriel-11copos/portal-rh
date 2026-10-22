const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const M = require('../../../lib/moedas');

// A carteira do colaborador: saldo, extrato, como ganhar, prêmios para trocar e as trocas dele. Só os dados dele.
// Programa desligado (ou tabelas ainda não instaladas): { habilitada: false } e a tela não mostra nada.
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const cfg = await M.lerConfig(prisma);
    if (!cfg.instalada || !cfg.ativo) return Response.json({ habilitada: false });

    const [saldo, lancamentos, premios, resgates, regras, missoes] = await Promise.all([
      M.saldoDe(prisma, sessao.id),
      prisma.moedaLancamento.findMany({ where: { colaboradorId: sessao.id }, orderBy: { criadoEm: 'desc' }, take: 100 }),
      prisma.moedaPremio.findMany({ where: { ativo: true } }),
      prisma.moedaResgate.findMany({ where: { colaboradorId: sessao.id }, orderBy: { criadoEm: 'desc' }, take: 20 }),
      prisma.moedaRegra.findMany(),
      prisma.missao.findMany({ where: { ativo: true } }),
    ]);
    const valorDe = new Map(regras.map((r) => [r.chave, r.valor]));
    const comoGanhar = [
      ...M.REGRAS_FIXAS.map((r) => ({ rotulo: r.rotulo, valor: valorDe.get(r.chave) || 0 })),
      ...missoes.map((m) => ({ rotulo: `Missão: ${m.titulo}`, valor: valorDe.get(`${M.PREFIXO_MISSAO}${m.id}`) || 0 })),
    ].filter((x) => x.valor > 0);

    return Response.json({
      habilitada: true,
      config: { nomeSingular: cfg.nomeSingular, nomePlural: cfg.nomePlural, simbolo: cfg.simbolo },
      saldo,
      extrato: lancamentos.map(M.visaoDoLancamento),
      comoGanhar,
      premios: premios.map((p) => ({ ...M.visaoDoPremio(p), podeTrocar: !(p.estoque !== null && p.estoque !== undefined && p.estoque <= 0) && saldo >= p.custo })).sort((a, b) => a.custo - b.custo || a.nome.localeCompare(b.nome, 'pt-BR')),
      resgates: resgates.map(M.visaoDoResgate),
    });
  } catch (err) {
    console.error('Erro ao carregar a carteira de moedas:', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
