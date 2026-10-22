const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// Quanto vale cada atividade (0 = não paga). A chave é uma das atividades do portal ou "missao:<id>".
async function PUT(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const chave = corpo && typeof corpo.chave === 'string' ? corpo.chave : '';
    const valor = M.inteiro(corpo && corpo.valor, 0, M.MAX_REGRA);
    if (valor === null) return Response.json({ erro: `O valor precisa ser um número de moedas entre 0 e ${M.MAX_REGRA}.` }, { status: 400 });

    let valida = M.REGRAS_FIXAS.some((r) => r.chave === chave);
    if (!valida && chave.startsWith(M.PREFIXO_MISSAO)) valida = !!(await prisma.missao.findUnique({ where: { id: chave.slice(M.PREFIXO_MISSAO.length) } }));
    if (!valida) return Response.json({ erro: 'Atividade desconhecida.' }, { status: 400 });

    await prisma.moedaRegra.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar a regra de moedas:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { PUT };
