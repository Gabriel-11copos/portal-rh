const { prisma } = require('../../../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../../../lib/auth');
const { urlDoArquivo } = require('../../../../../lib/contracheques');
const drive = require('../../../../../lib/driveContracheques');

const TIPOS = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

// Entrega o arquivo (PDF ou foto do comprovante). O colaborador só abre os DELE; o RH abre qualquer um. Sem login, não abre.
async function GET(req, { params }) {
  try {
    const rh = getSessaoRH();
    const colab = rh ? null : getSessaoColaborador();
    if (!rh && !colab) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const doc = await prisma.documento.findFirst({ where: { url: urlDoArquivo(params.id) } });
    if (!doc || (!rh && doc.colaboradorId !== colab.id)) return Response.json({ erro: 'Documento não encontrado.' }, { status: 404 });

    let buffer;
    try {
      buffer = await drive.baixarArquivo(params.id);
    } catch (err) {
      console.error('Erro ao baixar contracheque do Drive:', err);
      return Response.json({ erro: 'Não foi possível abrir o documento agora. Tente de novo em instantes.' }, { status: 502 });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': TIPOS[String(doc.nomeArquivo || '').split('.').pop().toLowerCase()] || 'application/pdf',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.nomeArquivo || 'documento.pdf')}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Erro ao entregar contracheque:', err);
    return Response.json({ erro: 'Não foi possível abrir o documento.' }, { status: 500 });
  }
}

module.exports = { GET };
