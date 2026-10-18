const { headers } = require('next/headers');
const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const { PERMISSOES, lerPermissoes } = require('../../../lib/permissoes');
const { tabelaNaoExiste, modelosInstalados, conferirMaster } = require('../../../lib/acesso');

// Só master. Lista os usuários do painel com o que cada um pode fazer e os assuntos que atende.
async function GET() {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const usuarios = await prisma.adminUsuario.findMany({ select: { id: true, nome: true, email: true, fotoUrl: true }, orderBy: { nome: 'asc' } });
    let linhas = [];
    let semTabela = !modelosInstalados(prisma);
    if (!semTabela) {
      try { linhas = await prisma.permissaoAdmin.findMany(); }
      catch (err) { if (!tabelaNaoExiste(err)) throw err; semTabela = true; }
    }
    let vinculos = [];
    if (!semTabela) {
      try { vinculos = await prisma.assuntoResponsavel.findMany(); }
      catch (err) { if (!tabelaNaoExiste(err)) throw err; }
    }
    const assuntos = await prisma.assunto.findMany({ select: { id: true, nome: true, ativo: true }, orderBy: { nome: 'asc' } });
    const nomeDoAssunto = new Map(assuntos.map((a) => [a.id, a.nome]));
    const ativo = linhas.length > 0;

    let middlewareAtivo = false;
    try { middlewareAtivo = !!headers().get('x-pathname'); } catch { /* ok */ }

    return Response.json({
      ativo, semTabela, middlewareAtivo, euId: sessao.id, catalogo: PERMISSOES,
      usuarios: usuarios.map((u) => {
        const linha = linhas.find((l) => l.usuarioId === u.id);
        return {
          ...u,
          perfil: !ativo ? 'master' : !linha ? 'sem_acesso' : linha.perfil,
          permissoes: linha && linha.perfil === 'personalizado' ? lerPermissoes(linha.permissoes) : [],
          assuntos: vinculos.filter((v) => v.usuarioId === u.id).map((v) => ({ id: v.assuntoId, nome: nomeDoAssunto.get(v.assuntoId) || '(assunto removido)' })),
        };
      }),
      assuntos,
    });
  } catch (err) {
    console.error('Erro ao listar as permissões:', err);
    return Response.json({ erro: 'Não foi possível carregar as permissões.' }, { status: 500 });
  }
}

// Só master. Ativa o controle de permissões: todos os usuários que já existem viram master (nada muda para ninguém);
// a partir daí, é só ir ajustando quem deve ter menos acesso. Usuários criados depois começam SEM acesso até receberem permissões.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const bloqueio = await conferirMaster(prisma, sessao);
    if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });
    const corpo = await req.json();
    if (corpo.acao !== 'ativar') return Response.json({ erro: 'Ação inválida.' }, { status: 400 });

    if (!modelosInstalados(prisma)) return Response.json({ erro: 'As tabelas de permissões ainda não foram criadas no banco. Rode o arquivo SQL da entrega.' }, { status: 409 });
    let existentes;
    try { existentes = await prisma.permissaoAdmin.findMany(); }
    catch (err) {
      if (tabelaNaoExiste(err)) return Response.json({ erro: 'As tabelas de permissões ainda não foram criadas no banco. Rode o arquivo SQL da entrega.' }, { status: 409 });
      throw err;
    }
    if (existentes.length > 0) return Response.json({ erro: 'O controle de permissões já está ativo.' }, { status: 409 });

    const usuarios = await prisma.adminUsuario.findMany({ select: { id: true } });
    await prisma.permissaoAdmin.createMany({
      data: usuarios.map((u) => ({ usuarioId: u.id, perfil: 'master', permissoes: [], atualizadoPor: typeof sessao.nome === 'string' ? sessao.nome : null })),
      skipDuplicates: true,
    });
    return Response.json({ ok: true, usuarios: usuarios.length });
  } catch (err) {
    console.error('Erro ao ativar as permissões:', err);
    return Response.json({ erro: 'Não foi possível ativar agora.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
