const { google } = require('googleapis');
const { Readable } = require('stream');

// Autenticação via Service Account do Google (configurada nas variáveis de ambiente).
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// Faz upload de um arquivo (buffer) para o Drive Compartilhado definido em GOOGLE_DRIVE_FOLDER_ID
// e retorna o link de visualização. Contas de serviço só funcionam em Drives Compartilhados
// (não em pastas normais do "Meu Drive"), por isso os parâmetros supportsAllDrives.
async function uploadArquivo(buffer, nomeArquivo, mimeType) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  // Permite que qualquer pessoa com o link acesse o arquivo (colaborador/RH podem não ser
  // membros do Drive Compartilhado).
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return res.data.webViewLink;
}

module.exports = { uploadArquivo };
