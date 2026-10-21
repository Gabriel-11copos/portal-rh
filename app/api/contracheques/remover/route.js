const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { idDriveDaUrl } = require('../../../../lib/contracheques');
const drive = require('../../../../lib/driveContracheques');

// Recolhe um documento enviado por engano: tira da conta do colaborador (ele deixa de ver) e apaga o arquivo do Drive.
// Só mexe em arquivos guardados pelo próprio portal. Depois, é só enviar o certo (ele volta a aparecer em "quem falta").
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo.documentoId !== 'string' || !corpo.documentoId) return Response.json({ erro: 'Informe o documento.' }, { status: 400 });

    const doc = await prisma.documento.findUnique({ where: { id: corpo.documentoId } });
    if (!doc) return Response.json({ erro: 'Documento não encontrado.' }, { status: 404 });
    const driveId = idDriveDaUrl(doc.url);
    if (!driveId) return Response.json({ erro: 'Este documento não foi guardado pelo portal; não é removido por aqui.' }, { status: 400 });

    // primeiro tira do colaborador (o acesso é cortado na hora); depois apaga o arquivo
    await prisma.documento.delete({ where: { id: doc.id } });
    console.log(`[contracheques] documento ${doc.id} (colaborador ${doc.colaboradorId}, ${doc.tipo} ${doc.competencia}) removido por ${sessao.nome || sessao.id}`);
    let arquivoApagado = true;
    try {
      await drive.apagarArquivo(driveId);
    } catch (err) {
      arquivoApagado = false;
      console.error('Documento removido do colaborador, mas o arquivo não foi apagado do Drive:', err && err.message);
    }
    return Response.json({ ok: true, arquivoApagado });
  } catch (err) {
    console.error('Erro ao remover documento:', err);
    return Response.json({ erro: 'Não foi possível remover agora.' }, { status: 500 });
  }
}

module.exports = { POST };
