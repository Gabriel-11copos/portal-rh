const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Só RH. Encerra a atualização liberada: os colaboradores param de ser avisados.
async function POST() {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const r = await prisma.campanhaDados.updateMany({ where: { ativa: true }, data: { ativa: false, encerradaEm: new Date() } });
    if (r.count === 0) return Response.json({ erro: 'Não há atualização liberada.' }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao encerrar a atualização de dados:', err);
    return Response.json({ erro: 'Não foi possível encerrar agora.' }, { status: 500 });
  }
}

module.exports = { POST };
