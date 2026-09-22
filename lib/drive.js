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

async function getAccessToken() {
  const auth = getAuth();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token;
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

// NOVO caminho rápido: cria uma "sessão de upload retomável" no Drive e devolve a URL.
// O ARQUIVO EM SI é enviado depois diretamente do navegador pra essa URL — sem passar
// pelo nosso servidor — o que evita o gargalo de vídeos/arquivos grandes trafegarem
// duas vezes (navegador -> nosso servidor -> Drive).
async function criarSessaoUploadResumable({ nomeArquivo, mimeType, pastaId }) {
  const token = await getAccessToken();
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      },
      body: JSON.stringify({ name: nomeArquivo, parents: [pastaId] }),
    }
  );
  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Falha ao iniciar upload no Drive: ${texto}`);
  }
  const sessionUrl = res.headers.get('location');
  if (!sessionUrl) throw new Error('Drive não retornou a URL de upload.');
  return sessionUrl;
}

// Libera o link do arquivo para "qualquer pessoa com o link" (colaborador/RH podem não
// ser membros do Drive Compartilhado).
async function definirPermissaoPublica(fileId) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
}

// Caminho ANTIGO (mantido por compatibilidade): sobe o arquivo passando pelo nosso
// servidor. Não é mais usado pela tela padrão de anexos, mas fica disponível.
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
    requestBody: { name: nomeArquivo, parents: [pastaDestino] },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  await definirPermissaoPublica(res.data.id);
  return res.data.webViewLink;
}

module.exports = {
  uploadArquivo,
  getOrCreatePastaColaborador,
  criarSessaoUploadResumable,
  definirPermissaoPublica,
};
