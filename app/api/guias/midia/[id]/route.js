const { prisma } = require('../../../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../../../lib/auth');

// Entrega uma imagem ou arquivo de um guia. Só para quem está logado (RH ou colaborador):
// diferente de um link público do Drive, não abre para quem não tem login no portal.
async function GET(req, { params }) {
  try {
    if (!getSessaoRH() && !getSessaoColaborador()) {
      return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    }
    const m = await prisma.guiaMidia.findUnique({ where: { id: params.id } });
    if (!m) return Response.json({ erro: 'Arquivo não encontrado.' }, { status: 404 });

    const aberturaNoNavegador = m.tipoMime.startsWith('image/') || m.tipoMime === 'application/pdf';
    return new Response(m.dados, {
      status: 200,
      headers: {
        'Content-Type': m.tipoMime,
        'Content-Length': String(m.dados.length),
        'Content-Disposition': `${aberturaNoNavegador ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(m.nome)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Erro ao entregar arquivo do guia:', err);
    return Response.json({ erro: 'Não foi possível abrir o arquivo.' }, { status: 500 });
  }
}

module.exports = { GET };
