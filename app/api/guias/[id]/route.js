const { prisma } = require('../../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../../lib/auth');
const { lerGuia, idsDeMidia } = require('../../../../lib/guias');

// Abre um guia com todos os blocos. O colaborador só abre guias publicados.
async function GET(req, { params }) {
  try {
    const rh = getSessaoRH();
    if (!rh && !getSessaoColaborador()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const g = await prisma.guia.findUnique({ where: { id: params.id } });
    if (!g || (!rh && !g.ativo)) return Response.json({ erro: 'Guia não encontrado.' }, { status: 404 });

    return Response.json({
      id: g.id, titulo: g.titulo, descricao: g.descricao, categoria: g.categoria, ativo: g.ativo,
      blocos: Array.isArray(g.blocos) ? g.blocos : [], atualizadoEm: g.atualizadoEm,
    });
  } catch (err) {
    console.error('Erro ao abrir guia:', err);
    return Response.json({ erro: 'Não foi possível abrir o guia.' }, { status: 500 });
  }
}

// Só RH: salva as alterações. Imagens e arquivos que saíram do guia são apagados do banco.
async function PUT(req, { params }) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const atual = await prisma.guia.findUnique({ where: { id: params.id } });
    if (!atual) return Response.json({ erro: 'Guia não encontrado.' }, { status: 404 });

    const { guia, erros } = lerGuia(await req.json());
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    const novos = idsDeMidia(guia.blocos);
    if (novos.length > 0) {
      const midias = await prisma.guiaMidia.findMany({ where: { id: { in: novos } }, select: { id: true, tipoMime: true } });
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

    // anota as imagens e arquivos de antes ANTES de salvar, para saber quais saíram do guia
    const antigos = idsDeMidia(atual.blocos);
    await prisma.guia.update({ where: { id: params.id }, data: guia });

    const removidos = antigos.filter((id) => !novos.includes(id));
    if (removidos.length > 0) await prisma.guiaMidia.deleteMany({ where: { id: { in: removidos } } });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar guia:', err);
    return Response.json({ erro: 'Não foi possível salvar o guia.' }, { status: 500 });
  }
}

// Só RH: apaga o guia e as imagens e arquivos dele.
async function DELETE(req, { params }) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const atual = await prisma.guia.findUnique({ where: { id: params.id } });
    if (!atual) return Response.json({ erro: 'Guia não encontrado.' }, { status: 404 });

    await prisma.guia.delete({ where: { id: params.id } });
    const ids = idsDeMidia(atual.blocos);
    if (ids.length > 0) await prisma.guiaMidia.deleteMany({ where: { id: { in: ids } } });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao apagar guia:', err);
    return Response.json({ erro: 'Não foi possível apagar o guia.' }, { status: 500 });
  }
}

module.exports = { GET, PUT, DELETE };
