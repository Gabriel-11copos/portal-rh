const { cookies, headers } = require('next/headers');
const { prisma } = require('../../../lib/db');
const { getSessaoRH, criarSessaoRH } = require('../../../lib/auth');
const { PAGINAS_DO_MENU, permitido } = require('../../../lib/permissoes');
const { carregarAcesso, assuntosDoUsuario, tabelaNaoExiste, modelosInstalados } = require('../../../lib/acesso');

const SEIS_HORAS = 60 * 60 * 6;

// O que o usuário do RH logado pode fazer AGORA (lido do banco). O menu usa isto para mostrar só o que a pessoa pode abrir.
// Aproveita para atualizar a sessão: se o master mudou as permissões, a pessoa passa a ter as novas sem precisar sair;
// se o usuário foi removido do painel, a sessão é encerrada.
async function GET() {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const usuario = await prisma.adminUsuario.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, fotoUrl: true } });
    if (!usuario) {
      cookies().delete('sessao_rh');
      return Response.json({ erro: 'Este usuário não existe mais.' }, { status: 401 });
    }
    const acesso = await carregarAcesso(prisma, usuario.id);
    if (acesso.perfil === 'sem_acesso') {
      cookies().delete('sessao_rh');
      return Response.json({ erro: 'Seu usuário não tem acesso ao painel.' }, { status: 403 });
    }

    const igual = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
    const mudou = acesso.perfil !== sessao.perfil || !igual(acesso.permissoes, sessao.permissoes) || usuario.nome !== sessao.nome;
    const velha = Math.floor(Date.now() / 1000) - (sessao.iat || 0) > SEIS_HORAS;
    if (mudou || velha) criarSessaoRH(usuario, acesso);   // renova (e leva as permissões novas)

    const assuntos = await assuntosDoUsuario(prisma, usuario.id);
    const veTudo = acesso.perfil === 'master' || acesso.permissoes.includes('solicitacoes');
    let assuntosDeSetor = [];
    if (veTudo && modelosInstalados(prisma)) {
      try { assuntosDeSetor = [...new Set((await prisma.assuntoResponsavel.findMany()).map((v) => v.assuntoId))]; }
      catch (err) { if (!tabelaNaoExiste(err)) throw err; }
    }

    let middlewareAtivo = false;
    try { middlewareAtivo = !!headers().get('x-pathname'); } catch { /* fora de uma requisição */ }

    return Response.json({
      usuario, perfil: acesso.perfil, permissoes: acesso.permissoes, legado: !!acesso.legado,
      paginas: PAGINAS_DO_MENU.filter((p) => permitido(acesso, p, 'GET')),
      assuntos,
      escopoSolicitacoes: veTudo ? 'todas' : assuntos.length > 0 ? 'meus' : 'nenhum',
      assuntosDeSetor,
      middlewareAtivo,
    });
  } catch (err) {
    console.error('Erro ao consultar o acesso:', err);
    return Response.json({ erro: 'Não foi possível consultar o acesso agora.' }, { status: 500 });
  }
}

module.exports = { GET };
