// Regras da senha de quem acessa o painel do RH/DP (o colaborador continua com a dele, criada a partir do CPF).
// Devolve a mensagem de erro, ou null se a senha serve.
function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.trim() === '') return 'Digite a nova senha.';
  if (senha.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (Buffer.byteLength(senha, 'utf8') > 72) return 'A senha pode ter no máximo 72 caracteres.'; // limite do bcrypt
  return null;
}

module.exports = { validarSenha };
