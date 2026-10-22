const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// Cria um prêmio para trocar por moedas (saldo no Zig ou prêmio). O custo é sempre editável depois.
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const { erros, dados } = M.validarPremio(corpo);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });
    const premio = await prisma.moedaPremio.create({ data: dados });
    return Response.json({ ok: true, id: premio.id });
  } catch (err) {
    console.error('Erro ao criar o prêmio:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { POST };
