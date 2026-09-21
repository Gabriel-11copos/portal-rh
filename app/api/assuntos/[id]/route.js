const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// RH edita um assunto existente (nome, prazo, responsável, resposta automática, ativo).
async function PATCH(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica, ativo } = await req.json();
  const { id } = params;

  const assunto = await prisma.assunto.update({
    where: { id },
    data: {
      nome,
      prazoPadraoDias,
      responsavelPadrao,
      respostaAutomatica: respostaAutomatica || null,
      ativo,
    },
  });

  return Response.json(assunto);
}

module.exports = { PATCH };
