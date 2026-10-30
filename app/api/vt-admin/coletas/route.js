const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');
const { notificarLote } = require('../../../../lib/whatsapp');

const EVENTO = { saldo: 'vt.saldo.liberado', mapeamento: 'vt.mapeamento.liberado' };
const diaMes = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(new Date(d)).map((x) => [x.type, x.value])); return `${p.day}/${p.month}`; };

// Avisa por WhatsApp quem entrou na coleta. A chave (coleta + pessoa) impede aviso repetido; se falhar, a coleta já está aberta.
async function avisar(coleta, ids) {
  try {
    const dados = coleta.prazo ? { prazo: diaMes(coleta.prazo) } : {};
    await notificarLote(prisma, ids.map((id) => ({ evento: EVENTO[coleta.tipo], chave: `vt:${coleta.tipo}:${coleta.id}:${id}`, colaboradorId: id, dados })));
  } catch (err) { console.error('WhatsApp (vale-transporte): não avisou', err && err.code); }
}

async function GET() {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try { return Response.json({ coletas: E.instalado(prisma) ? await E.listarColetas(prisma) : [] }); }
  catch (err) { console.error('Erro ao listar coletas:', err && err.code); return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 }); }
}

// O RH libera (para todos ou só para algumas pessoas), inclui mais pessoas, estende a todos ou encerra a coleta de saldo / de atualização do transporte.
async function POST(req) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  let corpo = null;
  try { corpo = await req.json(); } catch { corpo = null; }
  if (!corpo || typeof corpo !== 'object') return Response.json({ erro: 'Envie os dados.' }, { status: 400 });
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está instalado.' }, { status: 503 });
    if (corpo.acao === 'encerrar') {
      const r = await E.encerrarColeta(prisma, String(corpo.id || ''));
      return r.ok ? Response.json({ ok: true }) : Response.json({ erro: r.erro }, { status: r.status });
    }
    if (corpo.acao === 'incluir') {
      const r = await E.incluirNaColeta(prisma, corpo.id, corpo.colaboradorIds);
      if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
      await avisar(r.coleta, r.alvos);
      return Response.json({ ok: true, incluidos: r.incluidos, avisados: r.alvos.length, ignorados: r.ignorados });
    }
    if (corpo.acao === 'todos') {
      const r = await E.estenderColetaATodos(prisma, corpo.id);
      if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
      await avisar(r.coleta, r.alvos);
      return Response.json({ ok: true, avisados: r.alvos.length });
    }
    if (corpo.acao !== 'criar') return Response.json({ erro: 'Ação desconhecida.' }, { status: 400 });
    const r = await E.criarColeta(prisma, { tipo: corpo.tipo, titulo: corpo.titulo, prazo: corpo.prazo, usuario: rh.nome || 'RH', publico: corpo.publico, colaboradorIds: corpo.colaboradorIds });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
    await avisar(r.coleta, r.alvos);
    return Response.json({ ok: true, id: r.coleta.id, avisados: r.alvos.length, escolhidos: r.escolhidos, ignorados: r.ignorados });
  } catch (err) {
    console.error('Erro ao liberar a coleta:', err && err.code);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
