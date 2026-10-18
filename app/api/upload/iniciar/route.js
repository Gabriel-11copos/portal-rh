const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador, getSessaoRH } = require('../../../../lib/auth');
const { getOrCreatePastaColaborador, criarSessaoUploadResumable } = require('../../../../lib/drive');

// Prepara o upload: descobre a pasta certa no Drive e devolve uma URL de sessão pra
// onde o navegador vai enviar o arquivo diretamente (rápido, sem passar pelo servidor).
async function POST(req) {
  // só quem está logado (colaborador ou RH) pode iniciar um envio para o Drive da empresa
  const sessaoColaborador = getSessaoColaborador();
  if (!sessaoColaborador && !getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nomeArquivo, mimeType, colaboradorId: colaboradorIdInformado } = await req.json();
  let colaboradorId = colaboradorIdInformado;
  const origem = req.headers.get('origin') || undefined;

  if (sessaoColaborador) colaboradorId = sessaoColaborador.id;

  let pastaId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (colaboradorId) {
    const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
    pastaId = await getOrCreatePastaColaborador(colaboradorId, colaborador?.nome || 'Colaborador');
  }

  const sessionUrl = await criarSessaoUploadResumable({ nomeArquivo, mimeType, pastaId, origem });
  return Response.json({ sessionUrl });
}

module.exports = { POST };
