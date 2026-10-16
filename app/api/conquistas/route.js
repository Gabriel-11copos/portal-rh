const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const { hojeBrasilia, conquistasDeTempo, emMesDeAniversario, SELO_ANIVERSARIO } = require('../../../lib/selos');

// Tudo o que o colaborador conquistou: tempo de casa e aniversário (calculados na hora)
// e os selos que o RH concedeu (presença e reconhecimentos). Sempre só os dele.
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const c = await prisma.colaborador.findUnique({
      where: { id: sessao.id },
      select: { id: true, dataAdmissao: true, dataNascimento: true },
    });
    if (!c) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

    const hoje = hojeBrasilia();
    const tempo = conquistasDeTempo(c.dataAdmissao, hoje);
    const aniversario = emMesDeAniversario(c.dataNascimento, hoje) ? SELO_ANIVERSARIO : null;

    // Se a tabela dos selos ainda não existir, a tela continua mostrando tempo de casa e aniversário.
    let concedidos = [];
    try {
      const grants = await prisma.seloConcedido.findMany({
        where: { colaboradorId: c.id },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
      });
      if (grants.length > 0) {
        const selos = await prisma.selo.findMany({ where: { id: { in: [...new Set(grants.map((g) => g.seloId))] } } });
        const porId = new Map(selos.map((s) => [s.id, s]));
        concedidos = grants
          .filter((g) => porId.has(g.seloId))
          .map((g) => {
            const s = porId.get(g.seloId);
            return {
              id: g.id, nome: s.nome, descricao: s.descricao, icone: s.icone, grupo: s.grupo,
              data: g.data, mensagem: g.mensagem || null, novo: !g.vistoColaborador,
            };
          });
      }
    } catch (err) {
      console.error('Não foi possível ler os selos concedidos:', err);
    }

    const total = (tempo ? tempo.niveis.filter((n) => n.conquistado).length : 0) + (aniversario ? 1 : 0) + concedidos.length;
    return Response.json({ tempo, aniversario, concedidos, novos: concedidos.filter((g) => g.novo).length, total });
  } catch (err) {
    console.error('Erro ao carregar as conquistas:', err);
    return Response.json({ erro: 'Não foi possível carregar as conquistas agora.' }, { status: 500 });
  }
}

module.exports = { GET };
