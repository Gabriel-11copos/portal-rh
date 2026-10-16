const { prisma } = require('../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../lib/auth');
const { lerGuia, idsDeMidia } = require('../../../lib/guias');

// Lista os guias. O RH vê todos (inclusive rascunhos); o colaborador vê só os publicados.
async function GET() {
  try {
    const rh = getSessaoRH();
    if (!rh && !getSessaoColaborador()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const guias = await prisma.guia.findMany({
      where: rh ? {} : { ativo: true },
      orderBy: [{ categoria: 'asc' }, { titulo: 'asc' }],
    });
    return Response.json(
      guias.map((g) => ({
        id: g.id, titulo: g.titulo, descricao: g.descricao, categoria: g.categoria,
        ativo: g.ativo, atualizadoEm: g.atualizadoEm,
        blocos: Array.isArray(g.blocos) ? g.blocos.length : 0,
      }))
    );
  } catch (err) {
    console.error('Erro ao listar guias:', err);
    return Response.json({ erro: 'Não foi possível carregar os guias.' }, { status: 500 });
  }
}

// Só RH: cria um guia.
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { guia, erros } = lerGuia(await req.json());
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    // imagens e arquivos enviados precisam existir de verdade (e imagem tem que ser imagem)
    const ids = idsDeMidia(guia.blocos);
    if (ids.length > 0) {
      const midias = await prisma.guiaMidia.findMany({ where: { id: { in: ids } }, select: { id: true, tipoMime: true } });
      const porId = new Map(midias.map((m) => [m.id, m]));
      for (const b of guia.blocos) {
        if (!b.midiaId) continue;
        const m = porId.get(b.midiaId);
        if (!m) return Response.json({ erro: 'Um arquivo enviado não foi encontrado. Envie de novo.' }, { status: 400 });
        if (b.tipo === 'imagem' && !m.tipoMime.startsWith('image/')) {
          return Response.json({ erro: 'Um bloco de imagem aponta para um arquivo que não é imagem.' }, { status: 400 });
        }
      }
    }

    const criado = await prisma.guia.create({ data: guia });
    return Response.json({ id: criado.id });
  } catch (err) {
    console.error('Erro ao criar guia:', err);
    return Response.json({ erro: 'Não foi possível salvar o guia.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
