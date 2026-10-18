const { uploadArquivo } = require('../../../lib/drive');
const { getSessaoColaborador, getSessaoRH } = require('../../../lib/auth');
const { prisma } = require('../../../lib/db');

// Recebe um arquivo via multipart/form-data e devolve o link do Google Drive.
// Organiza dentro da subpasta do colaborador (do próprio, se for ele enviando;
// ou do colaborador informado, se for o RH enviando numa solicitação específica).
async function POST(req) {
  // só quem está logado (colaborador ou RH) pode enviar arquivos para o Drive da empresa
  const sessaoColaborador = getSessaoColaborador();
  if (!sessaoColaborador && !getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const formData = await req.formData();
  const arquivo = formData.get('arquivo');
  let colaboradorId = formData.get('colaboradorId');

  if (!arquivo) {
    return Response.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  if (sessaoColaborador) colaboradorId = sessaoColaborador.id;

  let nomeColaborador = null;
  if (colaboradorId) {
    const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
    nomeColaborador = colaborador?.nome;
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const link = await uploadArquivo(buffer, arquivo.name, arquivo.type, colaboradorId || null, nomeColaborador);

  return Response.json({ link, nomeArquivo: arquivo.name });
}

module.exports = { POST };
