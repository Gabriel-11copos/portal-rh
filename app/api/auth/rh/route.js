const { criarSessaoRH } = require('../../../../lib/auth');

async function POST(req) {
  const { senha } = await req.json();

  if (senha !== process.env.SENHA_RH) {
    return Response.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  criarSessaoRH();
  return Response.json({ ok: true });
}

module.exports = { POST };
