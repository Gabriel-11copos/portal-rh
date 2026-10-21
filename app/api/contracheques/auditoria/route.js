const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { lerTipo, lerCompetencia, PREFIXO_URL } = require('../../../../lib/contracheques');

// Lista os documentos de um tipo e competência (ex.: "Contracheque", "08/2026") para o RH conferir se cada arquivo
// é mesmo do dono. A conferência do CONTEÚDO é feita na tela (o PDF é lido no navegador); aqui só se entrega a lista.
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const url = new URL(req.url);
    const tipo = lerTipo(url.searchParams.get('tipo'));
    const competencia = lerCompetencia(url.searchParams.get('competencia'));
    if (!tipo || !competencia) return Response.json({ erro: 'Informe o tipo e a competência (MM/AAAA).' }, { status: 400 });

    const documentos = await prisma.documento.findMany({
      where: { tipo, competencia, url: { startsWith: PREFIXO_URL } },   // só arquivos guardados pelo portal
      include: { colaborador: { select: { id: true, nome: true, loja: true, ativo: true } } },
      orderBy: { criadoEm: 'asc' },
    });
    return Response.json({
      itens: documentos.map((d) => ({
        id: d.id, url: d.url, nomeArquivo: d.nomeArquivo, criadoEm: d.criadoEm,
        visto: !!d.vistoColaborador,   // o colaborador já abriu? (importante para avaliar um envio errado)
        colaborador: d.colaborador,
      })),
    });
  } catch (err) {
    console.error('Erro na auditoria de contracheques:', err);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
