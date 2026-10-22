const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const { hojeBrasilia, estadoDaMissao } = require('../../../lib/missoes');
const { creditar, lerConfig, saldoDe } = require('../../../lib/moedas');

// As missões abertas, com a situação de cada uma para quem está logado (só os dados dele).
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    // se as tabelas ainda não existirem, a tela simplesmente não mostra missões
    let missoes = [];
    let pedidos = [];
    let seloIds = new Set();
    let selos = [];
    try {
      missoes = await prisma.missao.findMany({ where: { ativo: true }, orderBy: { criadoEm: 'asc' } });
      if (missoes.length > 0) {
        pedidos = await prisma.missaoPedido.findMany({ where: { colaboradorId: sessao.id }, orderBy: { criadoEm: 'desc' } });
        const concedidos = await prisma.seloConcedido.findMany({ where: { colaboradorId: sessao.id } });
        seloIds = new Set(concedidos.map((g) => g.seloId));
        const idsDeSelo = [...new Set(missoes.map((m) => m.seloId).filter(Boolean))];
        if (idsDeSelo.length > 0) selos = await prisma.selo.findMany({ where: { id: { in: idsDeSelo } } });
      }
    } catch (err) {
      console.error('Não foi possível ler as missões:', err);
      return Response.json({ missoes: [], novos: 0 });
    }

    const hoje = hojeBrasilia();
    // moedas (só com o programa ligado): quanto cada missão rende
    let moedasAtivas = false;
    let cfgMoeda = null;
    const valorMoedas = new Map();
    try {
      cfgMoeda = await lerConfig(prisma);
      if (cfgMoeda.instalada && cfgMoeda.ativo) {
        moedasAtivas = true;
        (await prisma.moedaRegra.findMany()).forEach((r) => valorMoedas.set(r.chave, r.valor));
      }
    } catch (err) { console.error('Moedas: não foi possível ler (missões)', err && err.code); }
    const seloPorId = new Map(selos.map((s) => [s.id, s]));
    const lista = missoes.map((m) => {
      const meus = pedidos.filter((p) => p.missaoId === m.id);
      const { estado, podeEnviar } = estadoDaMissao(m, meus, seloIds, hoje);
      const selo = m.seloId && seloPorId.has(m.seloId) ? seloPorId.get(m.seloId) : null;
      return {
        id: m.id, titulo: m.titulo, descricao: m.descricao, modo: m.modo,
        rotuloReferencia: m.rotuloReferencia, recompensaTexto: m.recompensaTexto,
        repetivel: m.repetivel, prazo: m.prazo,
        moedas: moedasAtivas ? valorMoedas.get(`missao:${m.id}`) || 0 : 0,
        selo: selo ? { nome: selo.nome, icone: selo.icone } : null,
        estado, podeEnviar,
        pedidos: meus.map((p) => ({
          id: p.id, status: p.status, referencia: p.referencia, mensagem: p.mensagem, motivoRecusa: p.motivoRecusa,
          criadoEm: p.criadoEm, decididoEm: p.decididoEm, recompensaPendente: p.recompensaPendente,
          novo: p.status !== 'pendente' && !p.vistoColaborador,
        })),
      };
    });
    const novos = lista.reduce((n, m) => n + m.pedidos.filter((p) => p.novo).length, 0);
    // moedas: a missão que se cumpre sozinha (por selo) paga uma vez, na primeira vez que a pessoa a vê concluída
    let moeda = null;
    if (moedasAtivas) {
      for (const m of lista) {
        if (m.modo === 'selo' && m.estado === 'concluida') await creditar(prisma, { colaboradorId: sessao.id, origem: `missao:${m.id}`, referencia: 'selo', descricao: `Missão: ${m.titulo}` });
      }
      try { moeda = { simbolo: cfgMoeda.simbolo, nomeSingular: cfgMoeda.nomeSingular, nomePlural: cfgMoeda.nomePlural, saldo: await saldoDe(prisma, sessao.id) }; }
      catch (err) { console.error('Moedas: não foi possível ler o saldo (missões)', err && err.code); }
    }
    return Response.json({ missoes: lista, novos, moeda });
  } catch (err) {
    console.error('Erro ao carregar as missões:', err);
    return Response.json({ erro: 'Não foi possível carregar as missões agora.' }, { status: 500 });
  }
}

module.exports = { GET };
