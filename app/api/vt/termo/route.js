const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');
const { gerarPdfDoTermo } = require('../../../../lib/termoPdf');

// O termo de não optante que o próprio colaborador aceitou (PDF).
async function GET() {
  const s = getSessaoColaborador();
  if (!s) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    const t = await E.termoDoColaborador(prisma, s.id);
    if (!t) return Response.json({ erro: 'Você não tem termo assinado.' }, { status: 404 });
    const pdf = await gerarPdfDoTermo(t.texto);
    return new Response(pdf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(pdf.length), 'Content-Disposition': 'inline; filename="termo-nao-optante-vale-transporte.pdf"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Erro ao gerar o termo:', err && err.code);
    return Response.json({ erro: 'Não foi possível abrir o termo agora.' }, { status: 500 });
  }
}

module.exports = { GET };
