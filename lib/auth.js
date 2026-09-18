const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { cookies } = require('next/headers');

const SECRET = process.env.JWT_SECRET || 'troque-este-segredo';

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
  const token = cookies().get('sessao_colaborador')?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// --- RH (senha única compartilhada, como nos outros painéis) ---
function criarSessaoRH() {
  const token = jwt.sign({ tipo: 'rh' }, SECRET, { expiresIn: '30d' });
  cookies().set('sessao_rh', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 });
}

function getSessaoRH() {
  const token = cookies().get('sessao_rh')?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
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
