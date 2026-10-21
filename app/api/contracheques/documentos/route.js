const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { lerTipo, lerCompetencia, lerLoja, origemDoDocumento } = require('../../../../lib/contracheques');

const LIMITE = 5000;

// Documentos já enviados, para o RH gerenciar (ver, filtrar e excluir): de um tipo, e opcionalmente de uma competência e de uma loja.
// Traz também o resumo do tipo inteiro (quantos por competência e por loja), para o RH ver o que existe antes de filtrar.
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const url = new URL(req.url);
    const tipo = lerTipo(url.searchParams.get('tipo'));
    if (!tipo) return Response.json({ erro: 'Informe o tipo do documento.' }, { status: 400 });
    const competenciaTexto = url.searchParams.get('competencia');
    const competencia = competenciaTexto ? lerCompetencia(competenciaTexto) : null;
    if (competenciaTexto && !competencia) return Response.json({ erro: 'A competência precisa estar no formato MM/AAAA.' }, { status: 400 });
    const lojaTexto = url.searchParams.get('loja');
    const loja = lojaTexto ? lerLoja(lojaTexto) : null;
    if (lojaTexto && !loja) return Response.json({ erro: 'Loja inválida.' }, { status: 400 });

    const todos = await prisma.documento.findMany({ where: { tipo }, select: { competencia: true, colaborador: { select: { loja: true } } } });
    const contagem = new Map();
    for (const d of todos) {
      const chave = `${d.competencia}|${d.colaborador ? d.colaborador.loja : ''}`;
      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
    const resumo = [...contagem.entries()].map(([chave, total]) => { const [comp, lojaDoc] = chave.split('|'); return { competencia: comp, loja: lojaDoc, total }; })
      .sort((a, b) => b.competencia.split('/').reverse().join('').localeCompare(a.competencia.split('/').reverse().join('')) || a.loja.localeCompare(b.loja, 'pt-BR'));

    const where = { tipo, ...(competencia ? { competencia } : {}), ...(loja ? { colaborador: { loja } } : {}) };
    const documentos = await prisma.documento.findMany({
      where,
      include: { colaborador: { select: { id: true, nome: true, loja: true, ativo: true } } },
      orderBy: [{ criadoEm: 'desc' }],
      take: LIMITE + 1,
    });
    return Response.json({
      truncado: documentos.length > LIMITE,
      resumo,
      itens: documentos.slice(0, LIMITE).map((d) => ({
        id: d.id, tipo: d.tipo, competencia: d.competencia, nomeArquivo: d.nomeArquivo, criadoEm: d.criadoEm,
        origem: origemDoDocumento(d.url), visto: !!d.vistoColaborador, colaborador: d.colaborador,
      })),
    });
  } catch (err) {
    console.error('Erro ao listar documentos enviados:', err);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
