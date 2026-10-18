const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { cookies } = require('next/headers');

const SECRET = process.env.JWT_SECRET || 'troque-este-segredo';

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

// --- Colaborador ---
function criarSessaoColaborador(colaborador) {
  const token = jwt.sign(
    { id: colaborador.id, nome: colaborador.nome, tipo: 'colaborador' },
    SECRET,
    { expiresIn: '30d' }
  );
  cookies().set('sessao_colaborador', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 });
}

function getSessaoColaborador() {
  return lerSessao('sessao_colaborador', 'colaborador');
}

// --- RH (agora com usuários individuais, cada um com login e senha próprios) ---
function criarSessaoRH(adminUsuario) {
  const token = jwt.sign(
    { id: adminUsuario.id, nome: adminUsuario.nome, tipo: 'rh' },
    SECRET,
    { expiresIn: '30d' }
  );
  cookies().set('sessao_rh', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 });
}

function getSessaoRH() {
  return lerSessao('sessao_rh', 'rh');
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
  gerarHash,
  conferirSenha,
};
