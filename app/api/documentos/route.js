const { prisma } = require('../../../lib/db');
const { getSessaoColaborador, getSessaoRH } = require('../../../lib/auth');
const { ehDocumentoDeSaldo } = require('../../../lib/vt');

async function GET() {
  const sessaoColaborador = getSessaoColaborador();
  const sessaoRH = getSessaoRH();

  if (sessaoRH) {
    const documentos = await prisma.documento.findMany({
      include: { colaborador: true },
      orderBy: { criadoEm: 'desc' },
    });
    return Response.json(documentos.filter((d) => !ehDocumentoDeSaldo(d.tipo)));
  }

  if (sessaoColaborador) {
    const documentos = await prisma.documento.findMany({
      where: { colaboradorId: sessaoColaborador.id },
      orderBy: { criadoEm: 'desc' },
    });
    return Response.json(documentos.filter((d) => !ehDocumentoDeSaldo(d.tipo)));       // comprovantes de saldo do vale-transporte não são "documentos" dele
  }

  return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
}

module.exports = { GET };