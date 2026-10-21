const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { idDriveDeQualquerUrl } = require('../../../../lib/contracheques');
const drive = require('../../../../lib/driveContracheques');

const MAX_POR_VEZ = 300;

// Exclui documentos enviados (um ou vários): tira da conta do colaborador (ele deixa de ver) e apaga o arquivo do Drive,
// o que também derruba o link dos envios antigos, que estavam abertos a "qualquer pessoa com o link".
// Depois, é só enviar o certo em "Distribuir contracheques": quem foi excluído volta a aparecer em "quem falta".
// Corpo: { documentoId } ou { documentoIds: [...] }. Responde o que foi feito com cada um.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const pedidos = corpo && Array.isArray(corpo.documentoIds) ? corpo.documentoIds : corpo && typeof corpo.documentoId === 'string' ? [corpo.documentoId] : null;
    if (!pedidos || pedidos.length === 0 || pedidos.some((id) => typeof id !== 'string' || !id)) return Response.json({ erro: 'Informe os documentos.' }, { status: 400 });
    const ids = [...new Set(pedidos)];
    if (ids.length > MAX_POR_VEZ) return Response.json({ erro: `Exclua no máximo ${MAX_POR_VEZ} documentos por vez.` }, { status: 400 });

    const resultados = [];
    for (const id of ids) {
      try {
        const doc = await prisma.documento.findUnique({ where: { id } });
        if (!doc) { resultados.push({ id, ok: false, erro: 'Documento não encontrado.' }); continue; }
        const driveId = idDriveDeQualquerUrl(doc.url);
        // primeiro tira do colaborador (o acesso é cortado na hora); depois apaga o arquivo do Drive
        await prisma.documento.delete({ where: { id: doc.id } });
        console.log(`[contracheques] documento ${doc.id} (colaborador ${doc.colaboradorId}, ${doc.tipo} ${doc.competencia}) excluído por ${sessao.nome || sessao.id}`);
        let arquivoApagado = null;   // null: não havia arquivo do Drive para apagar
        if (driveId) {
          try { await drive.apagarArquivo(driveId); arquivoApagado = true; }
          catch (err) { arquivoApagado = false; console.error('Documento excluído do colaborador, mas o arquivo não foi apagado do Drive:', err && err.message); }
        }
        resultados.push({ id, ok: true, arquivoApagado });
      } catch (err) {
        console.error('Erro ao excluir documento:', err && err.message);
        resultados.push({ id, ok: false, erro: 'Não foi possível excluir.' });
      }
    }
    return Response.json({
      ok: resultados.every((r) => r.ok),
      excluidos: resultados.filter((r) => r.ok).length,
      arquivosNaoApagados: resultados.filter((r) => r.ok && r.arquivoApagado === false).map((r) => r.id),
      resultados,
      // compatível com o uso de um documento só
      ...(ids.length === 1 && resultados[0].ok ? { arquivoApagado: resultados[0].arquivoApagado !== false } : {}),
    });
  } catch (err) {
    console.error('Erro ao excluir documentos:', err);
    return Response.json({ erro: 'Não foi possível excluir agora.' }, { status: 500 });
  }
}

module.exports = { POST };
