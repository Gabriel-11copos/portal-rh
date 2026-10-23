const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const M = require('../../../../../lib/moedas');
const { notificar } = require('../../../../../lib/whatsapp');

// O RH marca a troca como entregue (já creditou o saldo no Zig ou entregou o prêmio) ou recusa (as moedas voltam para a pessoa).
async function POST(req, { params }) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const r = await M.decidirResgate(prisma, { resgateId: params.id, acao: corpo && corpo.acao, motivo: corpo && corpo.motivo, usuarioNome: sessao.nome });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
    // WhatsApp: avisa o resultado da troca (entregue, ou recusada com as moedas devolvidas)
    const troca = await prisma.moedaResgate.findUnique({ where: { id: params.id } });
    if (troca) await notificar(prisma, { evento: corpo.acao === 'entregar' ? 'troca.entregue' : 'troca.recusada', chave: `troca:${troca.id}:${corpo.acao}`, colaboradorId: troca.colaboradorId, dados: { premio: troca.premioNome } });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao decidir a troca:', err && err.code);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { POST };
