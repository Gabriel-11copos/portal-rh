const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const M = require('../../../lib/moedas');

// Visão geral do programa para o RH: configuração, o que cada atividade vale, prêmios, trocas a entregar e totais.
async function GET() {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ instalada: false });
    const cfg = await M.lerConfig(prisma);

    const [regras, missoes, premios, pendentes, recentes, soma] = await Promise.all([
      prisma.moedaRegra.findMany(),
      prisma.missao.findMany({ orderBy: { criadoEm: 'asc' } }),
      prisma.moedaPremio.findMany({}),
      prisma.moedaResgate.findMany({ where: { status: 'pendente' }, orderBy: { criadoEm: 'asc' } }),
      prisma.moedaResgate.findMany({ where: { status: { not: 'pendente' } }, orderBy: { decididoEm: 'desc' }, take: 30 }),
      prisma.moedaLancamento.aggregate({ _sum: { valor: true } }),
    ]);
    const valorDe = new Map(regras.map((r) => [r.chave, r.valor]));
    const ids = [...new Set([...pendentes, ...recentes].map((r) => r.colaboradorId))];
    const pessoas = ids.length ? await prisma.colaborador.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, loja: true } }) : [];
    const pessoaPor = new Map(pessoas.map((p) => [p.id, p]));
    const comPessoa = (r) => ({ ...M.visaoDoResgate(r), colaborador: pessoaPor.get(r.colaboradorId) || { id: r.colaboradorId, nome: '(colaborador removido)', loja: '' } });

    return Response.json({
      instalada: true,
      config: { ativo: cfg.ativo, nomeSingular: cfg.nomeSingular, nomePlural: cfg.nomePlural, simbolo: cfg.simbolo },
      regras: M.REGRAS_FIXAS.map((r) => ({ ...r, valor: valorDe.get(r.chave) || 0 })),
      missoes: missoes.map((m) => ({ chave: `${M.PREFIXO_MISSAO}${m.id}`, titulo: m.titulo, ativo: !!m.ativo, valor: valorDe.get(`${M.PREFIXO_MISSAO}${m.id}`) || 0 })),
      premios: premios.map(M.visaoDoPremio).sort((a, b) => a.custo - b.custo || a.nome.localeCompare(b.nome, 'pt-BR')),
      resgatesPendentes: pendentes.map(comPessoa),
      resgatesRecentes: recentes.map(comPessoa),
      emCirculacao: (soma && soma._sum && soma._sum.valor) || 0,
    });
  } catch (err) {
    console.error('Erro ao carregar as moedas (RH):', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
