const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { limparCodigo, gerarCodigo, codigoUnico } = require('../../../../lib/codigoAssunto');

// GGC edita um assunto existente (nome, prazo, responsável, resposta automática, ativo).
async function PATCH(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica, ativo, destino, fluxo, codigo } = await req.json();
  const { id } = params;

  // código: se o GGC mandou um, limpa e garante único; se mandou vazio, gera do nome
  let codigoFinal;
  if (codigo !== undefined) {
    const base = limparCodigo(codigo) || gerarCodigo(nome);
    codigoFinal = await codigoUnico(prisma, base, id);
  }

  const assunto = await prisma.assunto.update({
    where: { id },
    data: {
      nome,
      ...(codigoFinal !== undefined ? { codigo: codigoFinal } : {}),
      prazoPadraoDias,
      responsavelPadrao,
      respostaAutomatica: respostaAutomatica || null,
      ...(destino ? { destino: destino === 'gestor' ? 'gestor' : 'rh' } : {}),
      ...(fluxo ? { fluxo: ['atestado', 'uniforme'].includes(fluxo) ? fluxo : 'padrao' } : {}),
      ativo,
    },
  });

  return Response.json(assunto);
}

module.exports = { PATCH };
