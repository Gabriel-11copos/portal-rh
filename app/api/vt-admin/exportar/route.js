const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');

// Planilha (CSV, abre direto no Excel) com o transporte e o saldo de todos os ativos.
async function GET(req) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está instalado.' }, { status: 503 });
    const u = new URL(req.url);
    const { linhas } = await E.listaParaRH(prisma, { loja: u.searchParams.get('loja') || undefined });
    const hoje = E.agoraBR(); const dia = `${hoje.ano}-${String(hoje.mes).padStart(2, '0')}-${String(hoje.dia).padStart(2, '0')}`;
    return new Response(E.csvDoRH(linhas, hoje), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="vale-transporte-${dia}.csv"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (err) {
    console.error('Erro ao exportar o vale-transporte:', err && err.code);
    return Response.json({ erro: 'Não foi possível gerar a planilha agora.' }, { status: 500 });
  }
}

module.exports = { GET };
