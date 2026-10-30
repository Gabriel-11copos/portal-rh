const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const E = require('../../../lib/vtDados');

// Painel do RH: todos os colaboradores ativos com o transporte, os alertas e o saldo da coleta aberta.
async function GET(req) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    if (!E.instalado(prisma)) return Response.json({ instalado: false });
    const u = new URL(req.url);
    const [lista, coletas, unidades] = await Promise.all([E.listaParaRH(prisma, { loja: u.searchParams.get('loja') || undefined, busca: u.searchParams.get('busca') || undefined }), E.listarColetas(prisma), prisma.unidadeTransporte.findMany({ orderBy: { loja: 'asc' } })]);
    return Response.json({ instalado: true, ...lista, coletas, lojas: unidades.map((x) => x.loja) });
  } catch (err) {
    console.error('Erro no painel de benefícios:', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
