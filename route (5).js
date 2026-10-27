const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const C = require('../../../../lib/contatos');

// A base de colaboradores ATIVOS em planilha (CSV, abre direto no Excel), já com o celular atualizado:
// o da lista de ativos, o das atualizações de dados, ou o que o próprio colaborador confirmou no portal (a coluna "Origem" diz qual).
async function GET() {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const linhas = await C.linhasDaBase(prisma);
    const csv = C.montarCsv(C.COLUNAS_EXPORTACAO, linhas);
    const dia = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });   // AAAA-MM-DD, no horário de Brasília
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="base-de-ativos-${dia}.csv"`, 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Erro ao exportar a base de ativos:', err && err.code);
    return Response.json({ erro: 'Não foi possível exportar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
