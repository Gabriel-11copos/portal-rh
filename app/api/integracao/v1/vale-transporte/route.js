const { prisma } = require('../../../../../lib/db');
const { checarChave } = require('../../../../../lib/integracao');
const E = require('../../../../../lib/vtDados');

// O Portal do Gestor busca aqui o vale-transporte de todos os colaboradores ativos, com o valor do MÊS pedido
// (valor do dia x dias do mês; folgas, faltas e atestados são descontados no painel do gestor).
//   GET ?mes=2026-11   (padrão: mês atual)   &loja=Brewteco Gávea   &desde=2026-11-01T00:00:00Z (só o que mudou desde então)
// Autenticação: Authorization: Bearer <INTEGRACAO_API_KEY>. Não sai e-mail, rua, CEP nem foto: só o bairro de casa.
async function GET(req) {
  const negado = checarChave(req);
  if (negado) return negado;
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está instalado no portal.' }, { status: 503 });
    const u = new URL(req.url);
    let ano; let mes;
    const m = u.searchParams.get('mes');
    if (m) {
      const x = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(m);
      if (!x || Number(x[1]) < 2024 || Number(x[1]) > 2100) return Response.json({ erro: 'Use mes=AAAA-MM (ex.: 2026-11).' }, { status: 400 });
      ano = Number(x[1]); mes = Number(x[2]);
    }
    const desde = u.searchParams.get('desde');
    if (desde && isNaN(new Date(desde))) return Response.json({ erro: 'Use desde em formato de data (ex.: 2026-11-01T00:00:00Z).' }, { status: 400 });
    const dados = await E.linhasParaGestor(prisma, { ano, mes, loja: u.searchParams.get('loja') || undefined, desde: desde || undefined });
    return Response.json(dados, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Erro na API de vale-transporte para o gestor:', err && err.code);
    return Response.json({ erro: 'Não foi possível gerar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
