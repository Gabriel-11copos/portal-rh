const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Só RH. Lista enxuta de colaboradores (sem senha nem CPF) para o navegador identificar de quem é cada PDF.
async function GET() {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const lista = await prisma.colaborador.findMany({ select: { id: true, nome: true, loja: true, ativo: true } });
    return Response.json(lista);
  } catch (err) {
    console.error('Erro ao listar colaboradores para os contracheques:', err);
    return Response.json({ erro: 'Não foi possível carregar os colaboradores.' }, { status: 500 });
  }
}

module.exports = { GET };
