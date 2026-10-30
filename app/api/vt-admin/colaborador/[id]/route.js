const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const E = require('../../../../../lib/vtDados');
const { notificarLote } = require('../../../../../lib/whatsapp');

// Perfil de vale-transporte de UM colaborador (para o RH).
async function GET(req, { params }) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está instalado.' }, { status: 503 });
    const d = await E.detalheParaRH(prisma, params.id);
    if (!d) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });
    return Response.json(d);
  } catch (err) {
    console.error('Erro ao abrir o vale-transporte do colaborador:', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

// Ações do RH: resolver o alerta, reabrir o preenchimento, pedir nova foto do saldo ou preencher no lugar da pessoa.
async function POST(req, { params }) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  let corpo = null;
  try { corpo = await req.json(); } catch { corpo = null; }
  if (!corpo || typeof corpo !== 'object') return Response.json({ erro: 'Envie a ação.' }, { status: 400 });
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está instalado.' }, { status: 503 });
    const c = await prisma.colaborador.findUnique({ where: { id: params.id } });
    if (!c) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });
    const quem = rh.nome || 'RH';
    if (corpo.acao === 'resolver') {
      const r = await E.resolverAlerta(prisma, c.id, corpo.nota, quem);
      return r.ok ? Response.json({ ok: true }) : Response.json({ erro: r.erro }, { status: r.status });
    }
    if (corpo.acao === 'reabrir') {
      const r = await E.reabrirMapeamento(prisma, c.id);
      if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
      try { await notificarLote(prisma, [{ evento: 'vt.reaberto', chave: `vt:reaberto:${c.id}:${Date.now()}`, colaboradorId: c.id }]); } catch (err) { console.error('WhatsApp (vale-transporte): não avisou', err && err.code); }
      return Response.json({ ok: true });
    }
    if (corpo.acao === 'pedir_nova_foto') {
      const s = await prisma.saldoVT.findUnique({ where: { id: String(corpo.saldoId || '') } });
      if (!s || s.colaboradorId !== c.id) return Response.json({ erro: 'Saldo não encontrado.' }, { status: 404 });
      const r = await E.pedirNovaFoto(prisma, s.id, corpo.motivo);
      if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
      try { await notificarLote(prisma, [{ evento: 'vt.saldo.refazer', chave: `vt:refazer:${s.id}:${Date.now()}`, colaboradorId: c.id }]); } catch (err) { console.error('WhatsApp (vale-transporte): não avisou', err && err.code); }
      return Response.json({ ok: true });
    }
    if (corpo.acao === 'preencher') {
      const r = await E.salvarMapeamento(prisma, c, corpo.mapeamento, { autor: 'rh', nomeAutor: quem });
      return r.ok ? Response.json({ ok: true, valorDia: r.valorDia }) : Response.json({ erro: r.erros[0], erros: r.erros }, { status: r.status });
    }
    return Response.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro na ação do vale-transporte:', err && err.code);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
