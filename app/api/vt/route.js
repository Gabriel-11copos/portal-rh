const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const E = require('../../../lib/vtDados');

async function logado() {
  const s = getSessaoColaborador();
  if (!s) return null;
  const c = await prisma.colaborador.findUnique({ where: { id: s.id } });
  return c && c.ativo !== false ? c : null;
}

// O vale-transporte do colaborador logado: o que ele já informou, valores, trajeto, pendências e coleta de saldo aberta.
async function GET() {
  const c = await logado();
  if (!c) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    if (!E.instalado(prisma)) return Response.json({ disponivel: false });
    const st = await E.statusDoColaborador(prisma, c);
    const [termoParaLer, enderecoSugerido] = await Promise.all([st.podeEditar ? E.termoParaLer(prisma, c) : null, st.origem ? null : E.enderecoSugerido(prisma, c.id)]);
    return Response.json({ ...st, termoParaLer, enderecoSugerido, colaborador: { loja: c.loja, cargo: c.cargo } });
  } catch (err) {
    console.error('Erro ao ler o vale-transporte:', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}

// Salva o mapeamento (ou o termo de quem não usa). O valor é SEMPRE recalculado aqui, nunca confiado ao navegador.
async function PUT(req) {
  const c = await logado();
  if (!c) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  let corpo = null;
  try { corpo = await req.json(); } catch { corpo = null; }
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está disponível.' }, { status: 503 });
    const r = await E.salvarMapeamento(prisma, c, corpo);
    if (!r.ok) return Response.json({ erro: r.erros[0], erros: r.erros }, { status: r.status });
    return Response.json({ ok: true, usaVT: r.usaVT, modalidade: r.modalidade, valorViagem: r.valorViagem, valorDia: r.valorDia });
  } catch (err) {
    console.error('Erro ao salvar o vale-transporte:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}

module.exports = { GET, PUT };
