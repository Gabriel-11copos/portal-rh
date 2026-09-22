const { definirPermissaoPublica } = require('../../../../lib/drive');

// Depois que o navegador termina de enviar o arquivo direto pro Drive, liberamos o
// link de acesso (isso continua precisando da nossa credencial de servidor).
async function POST(req) {
  const { fileId } = await req.json();
  await definirPermissaoPublica(fileId);
  return Response.json({ ok: true });
}

module.exports = { POST };
