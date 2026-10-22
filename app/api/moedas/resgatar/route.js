const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// O colaborador troca moedas por um prêmio. As moedas saem na hora e o pedido vai para o RH entregar.
async function POST(req) {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo.premioId !== 'string' || !corpo.premioId) return Response.json({ erro: 'Escolha o prêmio.' }, { status: 400 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'O programa de moedas ainda não está disponível.' }, { status: 503 });

    const r = await M.resgatar(prisma, { colaboradorId: sessao.id, premioId: corpo.premioId });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
    return Response.json({ ok: true, saldo: r.saldo });
  } catch (err) {
    console.error('Erro ao trocar moedas:', err && err.code);
    return Response.json({ erro: 'Não foi possível trocar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}

module.exports = { POST };
