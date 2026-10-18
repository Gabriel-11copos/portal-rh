// Permissões do painel do RH: o que cada usuário pode fazer.
//
// Perfis:
//  - master: faz tudo (inclusive gerenciar usuários e permissões);
//  - personalizado: só o que estiver marcado na lista de permissões abaixo;
//  - sem_acesso: não entra (por exemplo, um usuário novo que ainda não recebeu permissões).
//
// Este arquivo é a ÚNICA fonte da verdade sobre "qual permissão cada tela e cada rota exige".
// Rota ou tela que não estiver nas tabelas abaixo é BLOQUEADA para quem não é master (nunca liberada por esquecimento).

const PERFIS = ['master', 'personalizado', 'sem_acesso'];

// O que dá para liberar para um usuário personalizado (gerenciar usuários e permissões fica só com o master).
const PERMISSOES = [
  { chave: 'solicitacoes', grupo: 'Atendimento', rotulo: 'Ver TODAS as solicitações', ajuda: 'Sem esta, a pessoa só vê as solicitações dos assuntos que ela atende.' },
  { chave: 'assuntos', grupo: 'Atendimento', rotulo: 'Assuntos, prazos e respostas automáticas' },
  { chave: 'comunicados', grupo: 'Comunicação', rotulo: 'Enviar comunicados' },
  { chave: 'conteudos', grupo: 'Comunicação', rotulo: 'Conteúdos (cursos, links, manuais)' },
  { chave: 'guias', grupo: 'Treinamento e reconhecimento', rotulo: 'Guias e treinamentos' },
  { chave: 'selos', grupo: 'Treinamento e reconhecimento', rotulo: 'Selos e conquistas' },
  { chave: 'missoes', grupo: 'Treinamento e reconhecimento', rotulo: 'Missões' },
  { chave: 'colaboradores', grupo: 'Pessoas', rotulo: 'Colaboradores (cadastro e planilha de ativos)' },
  { chave: 'dados', grupo: 'Pessoas', rotulo: 'Atualização de dados pessoais' },
  { chave: 'aniversariantes', grupo: 'Pessoas', rotulo: 'Aniversariantes' },
  { chave: 'escala', grupo: 'Pessoas', rotulo: 'Escala (prévia)' },
  { chave: 'documentos', grupo: 'Documentos e pagamento', rotulo: 'Enviar documento a um colaborador' },
  { chave: 'contracheques', grupo: 'Documentos e pagamento', rotulo: 'Distribuir contracheques' },
  { chave: 'gorjetas', grupo: 'Documentos e pagamento', rotulo: 'Gorjetas' },
];
const CHAVES = new Set(PERMISSOES.map((p) => p.chave));

// Aceita só permissões que existem (e sem repetir).
function lerPermissoes(lista) {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.map((x) => String(x)).filter((x) => CHAVES.has(x)))];
}

// Regras. Cada regra é:
//  'qualquer'         -> qualquer usuário do painel que tenha acesso (master ou personalizado);
//  'master'           -> só master;
//  ['a', 'b']         -> precisa de ALGUMA dessas permissões;
//  { GET: regra, '*': regra } -> regra diferente por método (ex: ver a lista é mais aberto do que alterar).
// A primeira regra que combinar vale; por isso as mais específicas vêm antes.
const FIM = '(?:/|$)';
const R = (texto) => new RegExp(`^${texto}${FIM}`);

const REGRAS_API = [
  // comuns a todo mundo do painel
  [R('/api/acesso'), 'qualquer'],
  [R('/api/admin-usuarios/perfil'), 'qualquer'],
  [R('/api/preferencias-painel'), 'qualquer'],
  [R('/api/upload'), 'qualquer'],
  [R('/api/guias/midia/[^/]+'), 'qualquer'],              // abrir imagens (guias, arte dos selos)
  [R('/api/solicitacoes'), 'qualquer'],                   // quais solicitações cada um vê é decidido por assunto, no próprio servidor
  // só master
  [R('/api/admin-usuarios'), 'master'],
  [R('/api/permissoes'), 'master'],
  [R('/api/assuntos/[^/]+/responsaveis'), 'master'],
  // por permissão
  [R('/api/assuntos'), ['assuntos']],
  [R('/api/aniversariantes'), ['aniversariantes']],
  [R('/api/atualizacao-dados-admin'), ['dados']],
  [R('/api/colaboradores'), { GET: ['colaboradores', 'comunicados', 'escala', 'selos'], '*': ['colaboradores'] }],
  [R('/api/comunicados'), ['comunicados']],
  [R('/api/conteudos'), ['conteudos']],
  [R('/api/contracheques/arquivo/[^/]+'), ['contracheques', 'documentos', 'dados']],
  [R('/api/contracheques/(?:elenco|publicar)'), ['contracheques', 'documentos']],
  [R('/api/contracheques'), ['contracheques']],
  [R('/api/documentos'), ['documentos', 'contracheques']],
  [R('/api/escalas'), ['escala']],
  [R('/api/gorjetas'), ['gorjetas']],
  [R('/api/guias/midia'), ['guias', 'selos']],
  [R('/api/guias'), ['guias']],
  [R('/api/missoes-admin'), ['missoes']],
  [R('/api/selos/(?:conceder|concedidos)'), ['selos']],
  [R('/api/selos'), { GET: ['selos', 'missoes'], '*': ['selos'] }],
];

const REGRAS_PAGINA = [
  [/^\/admin\/?$/, 'qualquer'],
  [R('/admin/solicitacoes'), 'qualquer'],
  [R('/admin/solicitacao'), 'qualquer'],
  [R('/admin/usuarios'), 'qualquer'],       // todos abrem para ver o próprio perfil; criar, listar e excluir usuários é só do master (a API barra)
  [R('/admin/permissoes'), 'master'],
  [R('/admin/assuntos'), ['assuntos']],
  [R('/admin/aniversariantes'), ['aniversariantes']],
  [R('/admin/atualizacao-dados'), ['dados']],
  [R('/admin/colaboradores'), ['colaboradores']],
  [R('/admin/comunicados'), ['comunicados']],
  [R('/admin/conteudos'), ['conteudos']],
  [R('/admin/contracheques'), ['contracheques']],
  [R('/admin/documentos'), ['documentos', 'contracheques']],
  [R('/admin/enviar-documento'), ['documentos']],
  [R('/admin/escala-previa'), ['escala']],
  [R('/admin/escalas-teste'), ['escala']],
  [R('/admin/gorjetas'), ['gorjetas']],
  [R('/admin/guias'), ['guias']],
  [R('/admin/missoes'), ['missoes']],
  [R('/admin/selos'), ['selos']],
];

// As telas que viram caixinha no menu (para esconder as que a pessoa não pode abrir).
const PAGINAS_DO_MENU = [
  '/admin/solicitacoes', '/admin/colaboradores', '/admin/comunicados', '/admin/enviar-documento', '/admin/contracheques',
  '/admin/gorjetas', '/admin/aniversariantes', '/admin/selos', '/admin/atualizacao-dados', '/admin/missoes',
  '/admin/escala-previa', '/admin/guias', '/admin/conteudos', '/admin/assuntos', '/admin/usuarios', '/admin/permissoes',
];

function limparCaminho(caminho) {
  let p;
  try { p = decodeURIComponent(String(caminho || '').split('?')[0].split('#')[0]); } catch { return null; }
  // caminho esquisito (voltar de pasta, barras duplas, contrabarra, caractere de controle): nunca é liberado
  if (!p.startsWith('/') || p.includes('..') || p.includes('//') || p.includes('\\') || /[\u0000-\u001f]/.test(p)) return null;
  return p;
}

function regraDe(caminho, metodo) {
  const p = limparCaminho(caminho);
  if (p === null) return { invalido: true };
  const tabela = p.startsWith('/api/') ? REGRAS_API : p.startsWith('/admin') ? REGRAS_PAGINA : null;
  if (!tabela) return { regra: null };
  for (const [re, regra] of tabela) {
    if (re.test(p)) {
      if (regra && typeof regra === 'object' && !Array.isArray(regra)) {
        const m = String(metodo || 'GET').toUpperCase();
        return { regra: regra[m] !== undefined ? regra[m] : regra['*'] };
      }
      return { regra };
    }
  }
  return { regra: null };
}

// O usuário (perfil + permissões) pode abrir este caminho com este método?
function permitido(acesso, caminho, metodo) {
  if (!acesso || !PERFIS.includes(acesso.perfil) || acesso.perfil === 'sem_acesso') return false;
  const { regra, invalido } = regraDe(caminho, metodo);
  if (invalido) return false;
  if (acesso.perfil === 'master') return true;
  if (regra === 'qualquer') return true;
  if (regra === 'master' || !Array.isArray(regra)) return false;      // só master, ou caminho sem regra: bloqueado
  const minhas = new Set(lerPermissoes(acesso.permissoes));
  return regra.some((p) => minhas.has(p));
}

module.exports = { PERFIS, PERMISSOES, CHAVES, lerPermissoes, REGRAS_API, REGRAS_PAGINA, PAGINAS_DO_MENU, permitido };
