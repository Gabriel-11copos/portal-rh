const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');

// Retorna os dados do próprio colaborador logado (para a tela "Meu Perfil" e para
// pré-preencher a abertura de solicitações).
async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const colaborador = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
  if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

  const { senhaHash, driveFolderId, ...dadosPublicos } = colaborador;
  return Response.json(dadosPublicos);
}

// Permite que o colaborador defina/edite seu nome social e sua foto de perfil.
async function PATCH(req) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nomeSocial, fotoUrl } = await req.json();

  const dados = {};
  if (nomeSocial !== undefined) dados.nomeSocial = nomeSocial?.trim() || null;
  if (fotoUrl !== undefined) dados.fotoUrl = fotoUrl;

  const colaborador = await prisma.colaborador.update({
    where: { id: sessao.id },
    data: dados,
  });

  const { senhaHash, driveFolderId, ...dadosPublicos } = colaborador;
  return Response.json(dadosPublicos);
}

module.exports = { GET, PATCH };
