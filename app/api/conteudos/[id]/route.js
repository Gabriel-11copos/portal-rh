const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

async function PATCH(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = params;
  const { categoria, titulo, descricao, tipo, url, nomeArquivo, ativo } = await req.json();

  const conteudo = await prisma.conteudo.update({
    where: { id },
    data: { categoria, titulo, descricao, tipo, url, nomeArquivo, ativo },
  });
  return Response.json(conteudo);
}

module.exports = { PATCH };
