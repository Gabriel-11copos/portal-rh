const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const { lerMissao } = require('../../../lib/missoes');

function diasDesde(data) {
  return Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 86400000));
}

// Só RH: tudo para gerenciar as missões (as missões, os pedidos esperando decisão e as recompensas a entregar).
async function GET() {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const [missoes, pendentes, aEntregar] = await Promise.all([
      prisma.missao.findMany({ orderBy: { criadoEm: 'asc' } }),
      prisma.missaoPedido.findMany({ where: { status: 'pendente' }, orderBy: { criadoEm: 'asc' } }),
      prisma.missaoPedido.findMany({ where: { status: 'aprovada', recompensaPendente: true }, orderBy: { decididoEm: 'asc' } }),
    ]);

    const colabIds = [...new Set([...pendentes, ...aEntregar].map((p) => p.colaboradorId))];
    const colabs = colabIds.length
      ? await prisma.colaborador.findMany({ where: { id: { in: colabIds } }, select: { id: true, nome: true, nomeSocial: true, loja: true } })
      : [];
    const selos = await prisma.selo.findMany({ where: { id: { in: [...new Set(missoes.map((m) => m.seloId).filter(Boolean))] } } });
    const cPorId = new Map(colabs.map((c) => [c.id, c]));
    const mPorId = new Map(missoes.map((m) => [m.id, m]));
    const sPorId = new Map(selos.map((s) => [s.id, s]));
    const quem = (id) => (cPorId.has(id) ? (cPorId.get(id).nomeSocial || cPorId.get(id).nome) : '(removido)');
    const loja = (id) => (cPorId.has(id) ? cPorId.get(id).loja : null);

    return Response.json({
      missoes: missoes.map((m) => ({
        ...m,
        selo: m.seloId && sPorId.has(m.seloId) ? { nome: sPorId.get(m.seloId).nome, icone: sPorId.get(m.seloId).icone } : null,
      })),
      pendentes: pendentes.map((p) => ({
        id: p.id, missao: mPorId.has(p.missaoId) ? mPorId.get(p.missaoId).titulo : '(missão removida)',
        rotuloReferencia: mPorId.has(p.missaoId) ? mPorId.get(p.missaoId).rotuloReferencia : '',
        colaborador: quem(p.colaboradorId), loja: loja(p.colaboradorId),
        referencia: p.referencia, mensagem: p.mensagem, criadoEm: p.criadoEm, dias: diasDesde(p.criadoEm),
      })),
      aEntregar: aEntregar.map((p) => ({
        id: p.id, missao: mPorId.has(p.missaoId) ? mPorId.get(p.missaoId).titulo : '(missão removida)',
        recompensa: mPorId.has(p.missaoId) ? mPorId.get(p.missaoId).recompensaTexto : '',
        colaborador: quem(p.colaboradorId), loja: loja(p.colaboradorId), referencia: p.referencia, decididoEm: p.decididoEm,
      })),
    });
  } catch (err) {
    console.error('Erro ao carregar as missões do RH:', err);
    return Response.json({ erro: 'Não foi possível carregar as missões.' }, { status: 500 });
  }
}

async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { erros, missao } = lerMissao(await req.json());
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    if (missao.seloId) {
      const selo = await prisma.selo.findUnique({ where: { id: missao.seloId } });
      if (!selo) return Response.json({ erro: 'O selo escolhido não existe.' }, { status: 400 });
    }
    const criada = await prisma.missao.create({ data: missao });
    return Response.json({ ok: true, id: criada.id });
  } catch (err) {
    console.error('Erro ao criar missão:', err);
    return Response.json({ erro: 'Não foi possível criar a missão.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
