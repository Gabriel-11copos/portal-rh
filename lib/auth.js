const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { cookies, headers } = require('next/headers');
const { PERFIS, lerPermissoes, permitido } = require('./permissoes');

const SECRET = process.env.JWT_SECRET || 'troque-este-segredo';

// A sessão do RH ganhou perfil e permissões (versão 2). Sessões antigas (de antes disso) não valem mais:
// quem estava logado precisa entrar de novo uma única vez.
const VERSAO_RH = 2;
const DURACAO_RH = 60 * 60 * 12;   // 12 horas (renovada sozinha enquanto a pessoa usa o painel)

// Confere a assinatura E o tipo da sessão. O mesmo segredo assina as sessões de colaborador e de RH,
// então sem conferir o tipo, um colaborador poderia copiar o próprio cookie para o cookie do RH e ser aceito como RH.
function lerSessao(nomeDoCookie, tipoEsperado) {
  const token = cookies().get(nomeDoCookie)?.value;
  if (!token) return null;
  try {
    const dados = jwt.verify(token, SECRET);
    return dados && dados.tipo === tipoEsperado ? dados : null;
  } catch {
    return null;
  }
}

function opcoesDoCookie(segundos) {
  return { httpOnly: true, path: '/', maxAge: segundos, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };
}

// --- Colaborador ---
function criarSessaoColaborador(colaborador) {
  const token = jwt.sign(
    { id: colaborador.id, nome: colaborador.nome, tipo: 'colaborador' },
    SECRET,
    { expiresIn: '30d' }
  );
  cookies().set('sessao_colaborador', token, opcoesDoCookie(60 * 60 * 24 * 30));
}

function getSessaoColaborador() {
  return lerSessao('sessao_colaborador', 'colaborador');
}

// --- RH (cada usuário com login e senha próprios, e com o que ele pode fazer) ---
// "acesso" = { perfil: 'master' | 'personalizado' | 'sem_acesso', permissoes: [...] }. Sem informar, não dá acesso a nada.
function criarSessaoRH(adminUsuario, acesso) {
  const perfil = acesso && PERFIS.includes(acesso.perfil) ? acesso.perfil : 'sem_acesso';
  const permissoes = perfil === 'personalizado' ? lerPermissoes(acesso.permissoes) : [];
  const token = jwt.sign(
    { id: adminUsuario.id, nome: adminUsuario.nome, tipo: 'rh', v: VERSAO_RH, perfil, permissoes },
    SECRET,
    { expiresIn: DURACAO_RH }
  );
  cookies().set('sessao_rh', token, opcoesDoCookie(DURACAO_RH));
}

// A sessão do RH, sem olhar o que a pessoa pode acessar (usada pelo menu e pela proteção das telas).
function getSessaoRHBruta() {
  const dados = lerSessao('sessao_rh', 'rh');
  return dados && dados.v === VERSAO_RH ? dados : null;
}

// Existe uma sessão do RH válida, mas de antes das permissões? (a pessoa só precisa entrar de novo)
function sessaoRHAntiga() {
  const dados = lerSessao('sessao_rh', 'rh');
  return !!dados && dados.v !== VERSAO_RH;
}

// A sessão do RH, SE a pessoa pode acessar o que está sendo pedido agora.
// O caminho e o método vêm do arquivo middleware.js (que sempre sobrescreve o que o navegador enviar).
// O master passa em tudo; os demais só no que a tabela de permissões liberar (rota sem regra: bloqueada).
function getSessaoRH() {
  const dados = getSessaoRHBruta();
  if (!dados) return null;
  if (dados.perfil === 'master') return dados;
  let caminho = null;
  let metodo = 'GET';
  try {
    const h = headers();
    caminho = h.get('x-pathname');
    metodo = h.get('x-metodo') || 'GET';
  } catch { /* fora de uma requisição: não há o que liberar */ }
  return permitido(dados, caminho, metodo) ? dados : null;
}

async function gerarHash(senha) {
  return bcrypt.hash(senha, 10);
}

async function conferirSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

module.exports = {
  criarSessaoColaborador,
  getSessaoColaborador,
  criarSessaoRH,
  getSessaoRH,
  getSessaoRHBruta,
  sessaoRHAntiga,
  VERSAO_RH,
  gerarHash,
  conferirSenha,
};
