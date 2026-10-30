const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');
const { notificarLote } = require('../../../../lib/whatsapp');

const EVENTO = { saldo: 'vt.saldo.liberado', mapeamento: 'vt.mapeamento.liberado' };
const diaMes = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(new Date(d)).map((x) => [x.type, x.value])); return `${p.day}/${p.month}`; };

async function GET() {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try { return Response.json({ coletas: E.instalado(prisma) ? await E.listarColetas(prisma) : [] }); }
  catch (err) { console.error('Erro ao listar coletas:', err && err.code); return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 }); }
}

// O RH libera (ou encerra) a coleta de saldo ou a atualização do mapeamento. Liberar avisa os colaboradores por WhatsApp.
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
    if (corpo.acao !== 'criar') return Response.json({ erro: 'Ação desconhecida.' }, { status: 400 });
    const r = await E.criarColeta(prisma, { tipo: corpo.tipo, titulo: corpo.titulo, prazo: corpo.prazo, usuario: rh.nome || 'RH' });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
    // WhatsApp: se falhar, a coleta já está aberta
    try {
      const dados = r.coleta.prazo ? { prazo: diaMes(r.coleta.prazo) } : {};
      await notificarLote(prisma, r.alvos.map((id) => ({ evento: EVENTO[r.coleta.tipo], chave: `vt:${r.coleta.tipo}:${r.coleta.id}:${id}`, colaboradorId: id, dados })));
    } catch (err) { console.error('WhatsApp (vale-transporte): não avisou', err && err.code); }
    return Response.json({ ok: true, id: r.coleta.id, avisados: r.alvos.length });
  } catch (err) {
    console.error('Erro ao liberar a coleta:', err && err.code);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
