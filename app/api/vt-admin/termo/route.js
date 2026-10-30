const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');
const { gerarPdfDoTermo } = require('../../../../lib/termoPdf');

// O termo de não optante de um colaborador (PDF), para o RH.
async function GET(req) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get('colaboradorId') || '';
    const t = id ? await E.termoDoColaborador(prisma, id) : null;
    if (!t) return Response.json({ erro: 'Este colaborador não tem termo assinado.' }, { status: 404 });
    const pdf = await gerarPdfDoTermo(t.texto);
    return new Response(pdf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(pdf.length), 'Content-Disposition': 'inline; filename="termo-nao-optante-vale-transporte.pdf"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Erro ao gerar o termo:', err && err.code);
    return Response.json({ erro: 'Não foi possível abrir o termo agora.' }, { status: 500 });
  }
}

module.exports = { GET };
