// Acesso ao Google Drive (conta de serviço) para guardar e entregar os contracheques.
// Usa as mesmas variáveis do resto do portal: GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_DRIVE_FOLDER_ID.

const { google } = require('googleapis');
const { Readable } = require('stream');
const { nomeDaPasta } = require('./contracheques');

let cliente = null;

function credenciais() {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!bruto) throw new Error('A chave do Google Drive não está configurada (GOOGLE_SERVICE_ACCOUNT_JSON).');
  let cred;
  try {
    cred = JSON.parse(bruto);
  } catch {
    throw new Error('A chave do Google Drive (GOOGLE_SERVICE_ACCOUNT_JSON) não é um JSON válido.');
  }
  if (cred.private_key) cred.private_key = String(cred.private_key).replace(/\\n/g, '\n');
  return cred;
}

function drive() {
  if (!cliente) {
    const auth = new google.auth.GoogleAuth({ credentials: credenciais(), scopes: ['https://www.googleapis.com/auth/drive'] });
    cliente = google.drive({ version: 'v3', auth });
  }
  return cliente;
}

function pastaRaiz() {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error('A pasta do Google Drive não está configurada (GOOGLE_DRIVE_FOLDER_ID).');
  return id;
}

// Traduz o erro do Google para uma frase que o RH entende, sem expor detalhes internos.
function explicar(err) {
  const codigo = err && (err.code || (err.response && err.response.status));
  if (codigo === 404) return 'O Drive não encontrou a pasta ou o arquivo, ou a conta do portal não tem acesso a ele.';
  if (codigo === 403) return 'A conta do portal não tem permissão para gravar nessa pasta do Drive.';
  if (codigo === 401 || /invalid_grant|unauthorized/i.test(String(err && err.message))) return 'O Google recusou a chave da conta do portal. Confira a variável GOOGLE_SERVICE_ACCOUNT_JSON.';
  return `Falha ao falar com o Drive: ${String((err && err.message) || 'erro desconhecido').slice(0, 160)}`;
}

// Devolve o id da pasta da pessoa; cria a pasta (e guarda o id no cadastro) se ainda não existir.
async function garantirPasta(prisma, colaborador) {
  if (colaborador.driveFolderId) return colaborador.driveFolderId;
  const r = await drive().files.create({
    requestBody: { name: nomeDaPasta(colaborador), mimeType: 'application/vnd.google-apps.folder', parents: [pastaRaiz()] },
    fields: 'id',
    supportsAllDrives: true,
  });
  await prisma.colaborador.update({ where: { id: colaborador.id }, data: { driveFolderId: r.data.id } });
  return r.data.id;
}

async function enviarPdf({ pastaId, nome, buffer }) {
  const r = await drive().files.create({
    requestBody: { name: nome, parents: [pastaId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });
  return r.data.id;
}

async function baixarArquivo(fileId) {
  const r = await drive().files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
  return Buffer.from(r.data);
}

async function apagarArquivo(fileId) {
  await drive().files.delete({ fileId, supportsAllDrives: true });
}

// Grava e apaga um arquivinho de teste na pasta principal, para confirmar que a conexão e a permissão funcionam.
async function testarConexao() {
  const raiz = pastaRaiz();
  const r = await drive().files.create({
    requestBody: { name: 'teste-conexao-portal.txt', parents: [raiz] },
    media: { mimeType: 'text/plain', body: Readable.from(Buffer.from('ok')) },
    fields: 'id',
    supportsAllDrives: true,
  });
  await drive().files.delete({ fileId: r.data.id, supportsAllDrives: true });
  return true;
}

module.exports = { garantirPasta, enviarPdf, baixarArquivo, apagarArquivo, testarConexao, explicar };
