const { prisma } = require('../../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../../lib/auth');
const { conferirMaster } = require('../../../../lib/acesso');

// Edita um usuário do RH/DP (nome, e-mail, foto, e opcionalmente redefine a senha). Só o master.
async function PATCH(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  const bloqueio = await conferirMaster(prisma, sessao);
  if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });

  const { id } = params;
  const { nome, email, fotoUrl, novaSenha } = await req.json();

  const dados = {};
  if (nome !== undefined) dados.nome = nome;
  if (email !== undefined) dados.email = email.toLowerCase().trim();
  if (fotoUrl !== undefined) dados.fotoUrl = fotoUrl;
  if (novaSenha) dados.senhaHash = await gerarHash(novaSenha);

  const usuario = await prisma.adminUsuario.update({ where: { id }, data: dados });
  const { senhaHash, ...dadosPublicos } = usuario;
  return Response.json(dadosPublicos);
}

// Exclui um usuário do RH/DP. Só o master, e nunca o próprio usuário.
// Também tira a pessoa dos assuntos que atendia e apaga o acesso e a ordem de caixinhas dela.
// O nome dela continua nas respostas e nos selos que já deu (ficam gravados como texto).
async function DELETE(req, { params }) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const bloqueio = await conferirMaster(prisma, sessao);
    if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });

    const { id } = params;
    if (id === sessao.id) return Response.json({ erro: 'Você não pode excluir o seu próprio usuário.' }, { status: 409 });
    const alvo = await prisma.adminUsuario.findUnique({ where: { id }, select: { id: true, nome: true } });
    if (!alvo) return Response.json({ erro: 'Usuário não encontrado.' }, { status: 404 });

    // limpa o que estava ligado à pessoa ANTES de excluí-la (para não sobrar acesso ou atendimento "órfão")
    if (prisma.permissaoAdmin) await prisma.permissaoAdmin.deleteMany({ where: { usuarioId: id } }).catch((e) => { if (!/does not exist|P2021/.test(String(e && (e.code || e.message)))) throw e; });
    if (prisma.assuntoResponsavel) await prisma.assuntoResponsavel.deleteMany({ where: { usuarioId: id } }).catch((e) => { if (!/does not exist|P2021/.test(String(e && (e.code || e.message)))) throw e; });
    if (prisma.preferenciaPainel) await prisma.preferenciaPainel.deleteMany({ where: { owner: `rh:${id}` } }).catch(() => {});
    await prisma.adminUsuario.delete({ where: { id } });
    return Response.json({ ok: true, nome: alvo.nome });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    return Response.json({ erro: 'Não foi possível excluir agora.' }, { status: 500 });
  }
}

module.exports = { PATCH, DELETE };
