const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Busca de colaboradores ativos por nome (só id, nome e loja), para escolher a quem dar ou tirar moedas.
// É uma rota própria para quem cuida das moedas não precisar da permissão de ver o cadastro completo.
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const q = String(new URL(req.url).searchParams.get('q') || '').trim().slice(0, 60);
    if (q.length < 2) return Response.json({ itens: [] });
    const pessoas = await prisma.colaborador.findMany({
      where: { ativo: true, OR: [{ nome: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, nome: true, loja: true },
      orderBy: { nome: 'asc' },
      take: 20,
    });
    return Response.json({ itens: pessoas });
  } catch (err) {
    console.error('Erro na busca de colaboradores (moedas):', err && err.code);
    return Response.json({ erro: 'Não foi possível buscar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
