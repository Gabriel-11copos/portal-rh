const { prisma } = require('../../../../lib/db');
const { conferirSenha, criarSessaoColaborador } = require('../../../../lib/auth');

async function POST(req) {
  const { matricula, senha } = await req.json();
  const cpfLimpo = matricula.replace(/\D/g, '');

  const colaborador = await prisma.colaborador.findUnique({ where: { matricula: cpfLimpo } });
  if (!colaborador) {
    return Response.json({ erro: 'Matrícula ou senha inválida.' }, { status: 401 });
  }

  const senhaOk = await conferirSenha(senha, colaborador.senhaHash);
  if (!senhaOk) {
    return Response.json({ erro: 'Matrícula ou senha inválida.' }, { status: 401 });
  }

  criarSessaoColaborador(colaborador);
  return Response.json({ ok: true });
}

module.exports = { POST };
