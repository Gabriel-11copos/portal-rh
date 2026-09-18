const { google } = require('googleapis');
const { Readable } = require('stream');
const { prisma } = require('./db');

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// Garante que existe uma subpasta no Drive Compartilhado para este colaborador
// (cria na primeira vez e guarda o ID no banco; nas próximas, reaproveita).
async function getOrCreatePastaColaborador(colaboradorId, nomeColaborador) {
  const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
  if (colaborador?.driveFolderId) return colaborador.driveFolderId;

  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.create({
    requestBody: {
      name: nomeColaborador,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  await prisma.colaborador.update({
    where: { id: colaboradorId },
    data: { driveFolderId: res.data.id },
  });

  return res.data.id;
}

// Faz upload de um arquivo para o Drive Compartilhado. Se colaboradorId for informado,
// organiza dentro da subpasta daquele colaborador (criando-a se ainda não existir).
async function uploadArquivo(buffer, nomeArquivo, mimeType, colaboradorId, nomeColaborador) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const pastaDestino = colaboradorId
    ? await getOrCreatePastaColaborador(colaboradorId, nomeColaborador || 'Colaborador')
    : process.env.GOOGLE_DRIVE_FOLDER_ID;

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [pastaDestino],
    },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return res.data.webViewLink;
}

module.exports = { uploadArquivo };
