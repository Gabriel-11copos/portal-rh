const { google } = require('googleapis');
const { Readable } = require('stream');

// Autenticação via Service Account do Google (configurada nas variáveis de ambiente).
// Passo a passo de como criar essa conta está no README.
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// Faz upload de um arquivo (buffer) para a pasta do Drive definida em GOOGLE_DRIVE_FOLDER_ID
// e retorna o link de visualização.
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
  });

  // Torna o arquivo visível para quem tem o link (dentro da organização, se preferir restringir depois)
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return res.data.webViewLink;
}

module.exports = { uploadArquivo };
