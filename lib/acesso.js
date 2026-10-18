// Consultas ao banco sobre o acesso de cada usuário do RH (perfil, permissões e assuntos que atende).
// Diferente do que vai dentro da sessão (que pode demorar um pouco para atualizar), aqui é sempre o que está valendo agora.

const { lerPermissoes } = require('./permissoes');

// A tabela ainda não foi criada no banco? (quem ainda não rodou o SQL continua como antes, sem controle de permissões)
function tabelaNaoExiste(err) {
  return !!err && (err.code === 'P2021' || /does not exist|não existe/i.test(String((err && err.message) || '')));
}

// Os modelos das permissões existem no Prisma (o arquivo schema.prisma foi atualizado e o site reconstruído)?
// Se não existirem, nada disto vale ainda e o painel funciona exatamente como antes.
function modelosInstalados(prisma) {
  return !!(prisma && prisma.permissaoAdmin && prisma.assuntoResponsavel);
}

// O acesso de um usuário do RH:
//  - enquanto o controle de permissões NÃO foi ativado (nenhuma linha na tabela), todo mundo é master, como sempre foi;
//  - depois de ativado, quem não tem linha na tabela não tem acesso a nada.
// Qualquer outro erro de banco NÃO libera nada: sobe o erro.
async function carregarAcesso(prisma, usuarioId) {
  if (!prisma.permissaoAdmin) return { perfil: 'master', permissoes: [], legado: true };
  let linhas;
  try {
    linhas = await prisma.permissaoAdmin.findMany();
  } catch (err) {
    if (tabelaNaoExiste(err)) return { perfil: 'master', permissoes: [], legado: true };
    throw err;
  }
  if (linhas.length === 0) return { perfil: 'master', permissoes: [], legado: true };
  const minha = linhas.find((l) => l.usuarioId === usuarioId);
  if (!minha || minha.perfil === 'sem_acesso') return { perfil: 'sem_acesso', permissoes: [] };
  if (minha.perfil === 'master') return { perfil: 'master', permissoes: [] };
  return { perfil: 'personalizado', permissoes: lerPermissoes(minha.permissoes) };
}

// Os assuntos que o usuário atende: [{ id, nome }]
async function assuntosDoUsuario(prisma, usuarioId) {
  if (!prisma.assuntoResponsavel) return [];
  let vinculos;
  try {
    vinculos = await prisma.assuntoResponsavel.findMany({ where: { usuarioId } });
  } catch (err) {
    if (tabelaNaoExiste(err)) return [];
    throw err;
  }
  if (vinculos.length === 0) return [];
  const assuntos = await prisma.assunto.findMany({ where: { id: { in: vinculos.map((v) => v.assuntoId) } }, select: { id: true, nome: true } });
  return assuntos.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

// Quais solicitações o usuário pode ver e responder: todas (master, ou com a permissão "solicitacoes"),
// ou só as dos assuntos que ele atende.
async function escopoSolicitacoes(prisma, sessao) {
  const acesso = await carregarAcesso(prisma, sessao.id);
  if (acesso.perfil === 'sem_acesso') return { todas: false, assuntoIds: [] };
  if (acesso.perfil === 'master' || acesso.permissoes.includes('solicitacoes')) return { todas: true, assuntoIds: [] };
  const assuntos = await assuntosDoUsuario(prisma, sessao.id);
  return { todas: false, assuntoIds: assuntos.map((a) => a.id) };
}

// Antes de responder, encerrar ou mudar o prazo: o usuário atende o assunto desta solicitação?
// Devolve null se pode, ou { status, erro } se não pode.
async function conferirAtendimento(prisma, sessao, solicitacaoId) {
  const s = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId }, select: { assuntoId: true } });
  if (!s) return { status: 404, erro: 'Solicitação não encontrada.' };
  const escopo = await escopoSolicitacoes(prisma, sessao);
  if (escopo.todas || escopo.assuntoIds.includes(s.assuntoId)) return null;
  return { status: 403, erro: 'Você não atende o assunto desta solicitação.' };
}

module.exports = { tabelaNaoExiste, modelosInstalados, carregarAcesso, assuntosDoUsuario, escopoSolicitacoes, conferirAtendimento };
