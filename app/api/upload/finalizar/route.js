const { definirPermissaoPublica } = require('../../../../lib/drive');
const { getSessaoColaborador, getSessaoRH } = require('../../../../lib/auth');

// Depois que o navegador termina de enviar o arquivo direto pro Drive, liberamos o
// link de acesso (isso continua precisando da nossa credencial de servidor).
async function POST(req) {
  // só quem está logado pode liberar um arquivo; e o código do arquivo precisa ter o formato de um código do Drive
  if (!getSessaoColaborador() && !getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  const { fileId } = await req.json();
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) return Response.json({ erro: 'Arquivo inválido.' }, { status: 400 });
  await definirPermissaoPublica(fileId);
  return Response.json({ ok: true });
}

module.exports = { POST };
