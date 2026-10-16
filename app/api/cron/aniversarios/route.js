const { prisma } = require('../../../../lib/db');
const { hojeBrasilia, criarComunicadosDoDia } = require('../../../../lib/aniversarios');

// Chamada todo dia de manhã pelo agendador do Vercel (ver vercel.json).
// Só aceita a chamada se vier com a senha CRON_SECRET: sem a variável configurada, recusa tudo.
async function GET(req) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return Response.json({ erro: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const resultado = await criarComunicadosDoDia(prisma, hojeBrasilia());
    return Response.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('Erro no agendador de aniversários:', err);
    return Response.json({ erro: 'Falha ao criar os comunicados de aniversário.' }, { status: 500 });
  }
}

module.exports = { GET };
