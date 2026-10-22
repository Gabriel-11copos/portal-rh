const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');
const M = require('../../../../lib/moedas');

// O saldo que aparece no cantinho de cima do portal. Programa desligado: { habilitada: false } e nada aparece.
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const cfg = await M.lerConfig(prisma);
    if (!cfg.instalada || !cfg.ativo) return Response.json({ habilitada: false });
    return Response.json({ habilitada: true, saldo: await M.saldoDe(prisma, sessao.id), simbolo: cfg.simbolo, nomeSingular: cfg.nomeSingular, nomePlural: cfg.nomePlural });
  } catch (err) {
    console.error('Erro ao ler o saldo de moedas:', err && err.code);
    return Response.json({ habilitada: false });   // o cabeçalho nunca quebra por causa das moedas
  }
}

module.exports = { GET };
