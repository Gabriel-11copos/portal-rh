const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { ordenarCombos, montarHistorico } = require('../../../../lib/contracheques');

// Só RH. Mostra, para um tipo e uma competência, quem já recebeu e quem falta, loja por loja,
// mais a lista dos envios feitos pelo portal. Lê os documentos registrados, então inclui
// também o que foi enviado pela tela antiga (.zip).
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const url = new URL(req.url);
    const tipoPedido = url.searchParams.get('tipo');
    const competenciaPedida = url.searchParams.get('competencia');

    const grupos = await prisma.documento.groupBy({
      by: ['tipo', 'competencia'],
      _count: { _all: true },
      _max: { criadoEm: true },
    });
    const combos = ordenarCombos(grupos);
    const escolhido = combos.find((c) => c.tipo === tipoPedido && c.competencia === competenciaPedida) || combos[0] || null;

    let painel = null;
    if (escolhido) {
      const [documentos, colaboradores] = await Promise.all([
        prisma.documento.findMany({ where: { tipo: escolhido.tipo, competencia: escolhido.competencia }, select: { colaboradorId: true, criadoEm: true } }),
        prisma.colaborador.findMany({ select: { id: true, nome: true, loja: true, ativo: true } }),
      ]);
      painel = montarHistorico({ colaboradores, documentos });
    }

    // se a tabela do registro de envios ainda não existir, o resto continua funcionando
    let lotes = [];
    try {
      lotes = await prisma.contrachequeLote.findMany({ orderBy: { criadoEm: 'desc' }, take: 40 });
    } catch (err) {
      console.error('Não foi possível ler o registro de envios:', err);
    }

    return Response.json({ combos, escolhido, painel, lotes });
  } catch (err) {
    console.error('Erro ao montar o histórico de contracheques:', err);
    return Response.json({ erro: 'Não foi possível carregar o histórico.' }, { status: 500 });
  }
}

module.exports = { GET };
