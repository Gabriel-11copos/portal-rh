const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const { hojeBrasilia, estadoDaMissao } = require('../../../lib/missoes');

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
    const seloPorId = new Map(selos.map((s) => [s.id, s]));
    const lista = missoes.map((m) => {
      const meus = pedidos.filter((p) => p.missaoId === m.id);
      const { estado, podeEnviar } = estadoDaMissao(m, meus, seloIds, hoje);
      const selo = m.seloId && seloPorId.has(m.seloId) ? seloPorId.get(m.seloId) : null;
      return {
        id: m.id, titulo: m.titulo, descricao: m.descricao, modo: m.modo,
        rotuloReferencia: m.rotuloReferencia, recompensaTexto: m.recompensaTexto,
        repetivel: m.repetivel, prazo: m.prazo,
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
    return Response.json({ missoes: lista, novos });
  } catch (err) {
    console.error('Erro ao carregar as missões:', err);
    return Response.json({ erro: 'Não foi possível carregar as missões agora.' }, { status: 500 });
  }
}

module.exports = { GET };
