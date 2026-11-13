// Gera o código de integração de um assunto (usado no campo "tipo" das mensagens de WhatsApp).
// Tira acentos, troca o que não é letra/número por "_", deixa MAIÚSCULO e corta num tamanho razoável.
// Ex.: "Segunda via de vale-transporte" -> "SEGUNDA_VIA_DE_VALE_TRANSPORTE"

function gerarCodigo(nome) {
  const base = String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // tira acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')                         // tudo que não é letra/número vira _
    .replace(/^_+|_+$/g, '')                             // tira _ do começo/fim
    .slice(0, 40);
  return base || 'ASSUNTO';
}

// Limpa um código que o GGC digitou à mão (mesma regra, mas respeita o que a pessoa quis).
function limparCodigo(valor) {
  const c = String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return c || null;
}

// Garante que o código é único: se já existe, acrescenta _2, _3...
async function codigoUnico(prisma, base, ignorarId) {
  let codigo = base; let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existe = await prisma.assunto.findFirst({ where: { codigo, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
    if (!existe) return codigo;
    n += 1;
    codigo = `${base.slice(0, 37)}_${n}`;
  }
}

module.exports = { gerarCodigo, limparCodigo, codigoUnico };
