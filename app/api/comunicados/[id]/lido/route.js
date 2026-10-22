const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');
const { creditar } = require('../../../../../lib/moedas');

async function POST(req, { params }) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = params;
  const comunicado = await prisma.comunicado.findUnique({ where: { id } });
  if (!comunicado || comunicado.colaboradorId !== sessao.id) {
    return Response.json({ erro: 'Comunicado não encontrado.' }, { status: 404 });
  }

  await prisma.comunicado.update({
    where: { id },
    data: { lido: true, lidoEm: new Date() },
  });

  // moedas: ler o comunicado rende (uma vez por comunicado; só vale com o programa ligado e um valor definido)
  await creditar(prisma, { colaboradorId: sessao.id, origem: 'leu_comunicado', referencia: id, descricao: 'Leu um comunicado' });

  return Response.json({ ok: true });
}

module.exports = { POST };
