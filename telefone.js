// Telefone de celular brasileiro: leitura, formato para guardar e formato para mostrar.

// "(21) 99999-1234" -> "5521999991234" (55 + DDD + celular). Sem celular válido: null.
function normalizarTelefone(valor) {
  let n = String(valor == null ? '' : valor).replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (!/^55\d{10,11}$/.test(n)) return null;
  const ddd = Number(n.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  const local = n.slice(4);
  if (local.length === 9 && local[0] !== '9') return null;        // celular tem 9 dígitos e começa com 9
  if (local.length === 8 && !/^[6-9]/.test(local)) return null;   // fixo (começa com 2 a 5) não recebe WhatsApp
  return n;
}

// "5521999991234" -> "(21) 99999-1234"
function formatarTelefone(digitos) {
  const n = String(digitos || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return String(digitos || '');
}

const mascarar = (telefone) => (telefone ? `••••${String(telefone).slice(-4)}` : '');

module.exports = { normalizarTelefone, formatarTelefone, mascarar };
