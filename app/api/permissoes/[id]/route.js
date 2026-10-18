const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { PERFIS, lerPermissoes } = require('../../../../lib/permissoes');
const { tabelaNaoExiste, modelosInstalados, conferirMaster } = require('../../../../lib/acesso');

// Só master. Define o perfil (master, personalizado ou sem acesso) e as permissões de um usuário.
async function PUT(req, { params }) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const bloqueio = await conferirMaster(prisma, sessao);
    if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });
    const corpo = await req.json();
    const perfil = corpo.perfil;
    if (!PERFIS.includes(perfil)) return Response.json({ erro: 'Perfil inválido.' }, { status: 400 });

    if (!modelosInstalados(prisma)) return Response.json({ erro: 'As tabelas de permissões ainda não foram criadas no banco.' }, { status: 409 });
    let linhas;
    try { linhas = await prisma.permissaoAdmin.findMany(); }
    catch (err) {
      if (tabelaNaoExiste(err)) return Response.json({ erro: 'As tabelas de permissões ainda não foram criadas no banco.' }, { status: 409 });
      throw err;
    }
    if (linhas.length === 0) return Response.json({ erro: 'Ative o controle de permissões antes de definir o acesso de cada pessoa.' }, { status: 409 });

    const alvo = await prisma.adminUsuario.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!alvo) return Response.json({ erro: 'Usuário não encontrado.' }, { status: 404 });

    const atual = linhas.find((l) => l.usuarioId === alvo.id) || null;
    const eraMaster = !!atual && atual.perfil === 'master';
    if (alvo.id === sessao.id && perfil !== 'master') return Response.json({ erro: 'Você não pode tirar o seu próprio acesso de master. Peça a outro master.' }, { status: 409 });
    if (eraMaster && perfil !== 'master' && linhas.filter((l) => l.perfil === 'master').length <= 1) {
      return Response.json({ erro: 'É preciso haver pelo menos um master.' }, { status: 409 });
    }

    const dados = {
      perfil,
      permissoes: perfil === 'personalizado' ? lerPermissoes(corpo.permissoes) : [],
      atualizadoPor: typeof sessao.nome === 'string' ? sessao.nome : null,
      atualizadoEm: new Date(),
    };
    await prisma.permissaoAdmin.upsert({ where: { usuarioId: alvo.id }, create: { usuarioId: alvo.id, ...dados }, update: dados });

    // dois masters tirando o acesso um do outro ao mesmo tempo: se não sobrou nenhum, desfaz
    if (eraMaster && perfil !== 'master' && (await prisma.permissaoAdmin.count({ where: { perfil: 'master' } })) === 0) {
      await prisma.permissaoAdmin.update({ where: { usuarioId: alvo.id }, data: { perfil: 'master', permissoes: [] } });
      return Response.json({ erro: 'É preciso haver pelo menos um master.' }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar as permissões:', err);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { PUT };
