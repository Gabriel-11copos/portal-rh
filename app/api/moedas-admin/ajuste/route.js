const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// O RH dá (número positivo) ou tira (negativo) moedas de uma pessoa, sempre com um motivo que fica no extrato dela.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo.colaboradorId !== 'string' || !corpo.colaboradorId) return Response.json({ erro: 'Escolha o colaborador.' }, { status: 400 });
    const r = await M.ajustar(prisma, { colaboradorId: corpo.colaboradorId, valor: corpo.valor, motivo: corpo.motivo, usuarioNome: sessao.nome });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
    return Response.json({ ok: true, saldo: r.saldo });
  } catch (err) {
    console.error('Erro ao ajustar moedas:', err && err.code);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { POST };
