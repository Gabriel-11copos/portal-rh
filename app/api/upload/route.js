const { uploadArquivo } = require('../../../lib/drive');

// Recebe um arquivo via multipart/form-data e devolve o link do Google Drive.
async function POST(req) {
  const formData = await req.formData();
  const arquivo = formData.get('arquivo');

  if (!arquivo) {
    return Response.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const link = await uploadArquivo(buffer, arquivo.name, arquivo.type);

  return Response.json({ link, nomeArquivo: arquivo.name });
}

module.exports = { POST };
