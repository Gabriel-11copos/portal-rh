const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// Liga/desliga o programa e define o nome da moeda (singular, plural) e o símbolo.
async function PUT(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const { erros, dados } = M.validarConfig(corpo);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });
    await prisma.moedaConfig.upsert({ where: { id: 'unico' }, create: { id: 'unico', ...dados }, update: dados });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar a configuração das moedas:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { PUT };
