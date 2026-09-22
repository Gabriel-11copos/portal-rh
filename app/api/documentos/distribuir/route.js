const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { uploadArquivo } = require('../../../../lib/drive');
const { processarContracheques } = require('../../../../lib/holerites');

// Pede ao Vercel o máximo de tempo permitido pra essa rota (processar dezenas de
// arquivos e subir cada um pro Drive pode levar mais que o padrão de poucos segundos).
export const maxDuration = 300;

// Processa lotes com um limite de uploads simultâneos, pra não estourar tempo
// de execução nem sobrecarregar a API do Drive.
async function processarEmLotes(itens, tamanhoLote, fn) {
  const resultados = [];
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    const lote = itens.slice(i, i + tamanhoLote);
    const parciais = await Promise.all(lote.map(fn));
    resultados.push(...parciais);
  }
  return resultados;
}

// Recebe o PDF consolidado ORIGINAL (o mesmo que vem do sistema de folha, sem
// precisar de nenhum tratamento prévio). O próprio servidor identifica cada
// colaborador pelo nome + loja, separa em PDFs individuais, sobe pra pasta de
// cada um no Drive, e registra em "Documentos".
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const formData = await req.formData();
    const arquivoPdf = formData.get('arquivo');
    const tipo = formData.get('tipo') || 'Contracheque';
    const competencia = formData.get('competencia');

    if (!arquivoPdf) return Response.json({ erro: 'Nenhum PDF enviado.' }, { status: 400 });
    if (!competencia) return Response.json({ erro: 'Informe a competência (ex: 08/2026).' }, { status: 400 });

    const buffer = Buffer.from(await arquivoPdf.arrayBuffer());
    const colaboradores = await prisma.colaborador.findMany({ select: { id: true, nome: true, matricula: true, loja: true } });
    const colaboradoresComCpf = colaboradores.map((c) => ({ ...c, cpf: c.matricula }));

    const { distribuidos, naoDistribuidos } = await processarContracheques(buffer, colaboradoresComCpf);

    const resultados = await processarEmLotes(distribuidos, 10, async (item) => {
      const nomeArquivo = `${tipo} - ${competencia}.pdf`;
      const link = await uploadArquivo(item.bytes, nomeArquivo, 'application/pdf', item.colaboradorId, item.nome);

      const existente = await prisma.documento.findFirst({
        where: { colaboradorId: item.colaboradorId, tipo, competencia },
      });
      if (existente) {
        await prisma.documento.update({
          where: { id: existente.id },
          data: { url: link, nomeArquivo, vistoColaborador: false, criadoEm: new Date() },
        });
      } else {
        await prisma.documento.create({
          data: { colaboradorId: item.colaboradorId, tipo, competencia, url: link, nomeArquivo },
        });
      }
      return { nome: item.nome, cpf: item.cpf };
    });

    return Response.json({ ok: true, distribuidos: resultados, naoEncontrados: naoDistribuidos });
  } catch (err) {
    console.error('Erro ao distribuir documentos:', err);
    return Response.json({ erro: `Erro ao processar: ${err.message || 'erro desconhecido'}` }, { status: 500 });
  }
}

module.exports = { POST };
