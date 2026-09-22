const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');
const { getOrCreatePastaColaborador, criarSessaoUploadResumable } = require('../../../../lib/drive');

// Prepara o upload: descobre a pasta certa no Drive e devolve uma URL de sessão pra
// onde o navegador vai enviar o arquivo diretamente (rápido, sem passar pelo servidor).
async function POST(req) {
  const { nomeArquivo, mimeType, colaboradorId: colaboradorIdInformado } = await req.json();
  let colaboradorId = colaboradorIdInformado;

  const sessaoColaborador = getSessaoColaborador();
  if (sessaoColaborador) colaboradorId = sessaoColaborador.id;

  let pastaId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (colaboradorId) {
    const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
    pastaId = await getOrCreatePastaColaborador(colaboradorId, colaborador?.nome || 'Colaborador');
  }

  const sessionUrl = await criarSessaoUploadResumable({ nomeArquivo, mimeType, pastaId });
  return Response.json({ sessionUrl });
}

module.exports = { POST };
