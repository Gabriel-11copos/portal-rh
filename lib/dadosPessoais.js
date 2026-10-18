// Atualização de dados pessoais: o RH libera uma "campanha" de vez em quando e cada colaborador informa
// telefone, e-mail, endereço completo e anexa um comprovante de residência.
// Este arquivo só decide o que é válido; quem grava no banco e no Drive são as rotas.

const FUSO = 'America/Sao_Paulo';
const MAX_COMPROVANTE = 4 * 1024 * 1024;   // limite do envio no Vercel (~4,5 MB)
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const TIPO_COMPROVANTE = 'Comprovante de residência';

function apenasDigitos(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

// Telefone brasileiro: DDD + 8 ou 9 dígitos (aceita +55 na frente). Devolve só os dígitos, ou null.
function lerTelefone(v) {
  let d = apenasDigitos(v);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (Number(d.slice(0, 2)) < 11) return null;
  if (d.length === 11 && d[2] !== '9') return null;     // celular começa com 9
  return d;
}

function formatarTelefone(v) {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function lerEmail(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

function lerCep(v) {
  const d = apenasDigitos(v);
  return d.length === 8 ? d : null;
}

function formatarCep(v) {
  const d = apenasDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function texto(v, min, max) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s.length >= min && s.length <= max ? s : null;
}

// Valida o que o colaborador preencheu. Devolve { erros: [...], dados }.
function lerAtualizacao(corpo) {
  const erros = [];
  const dados = {};
  const exige = (campo, valor, mensagem) => { if (valor === null) erros.push(mensagem); else dados[campo] = valor; };

  exige('telefone', lerTelefone(corpo.telefone), 'Informe um telefone válido com DDD (ex: (21) 99999-9999).');
  exige('email', lerEmail(corpo.email), 'Informe um e-mail válido.');
  exige('cep', lerCep(corpo.cep), 'Informe o CEP com 8 números.');
  exige('logradouro', texto(corpo.logradouro, 3, 120), 'Informe a rua (logradouro).');
  exige('numero', texto(corpo.numero, 1, 10), 'Informe o número (ou "S/N").');
  exige('bairro', texto(corpo.bairro, 2, 80), 'Informe o bairro.');
  exige('cidade', texto(corpo.cidade, 2, 80), 'Informe a cidade.');
  const uf = String(corpo.uf || '').trim().toUpperCase();
  exige('uf', UFS.includes(uf) ? uf : null, 'Escolha o estado (UF).');

  const comp = String(corpo.complemento == null ? '' : corpo.complemento).replace(/\s+/g, ' ').trim();
  if (comp.length > 60) erros.push('O complemento pode ter no máximo 60 letras.');
  else dados.complemento = comp || null;

  return { erros, dados };
}

// Descobre o tipo do arquivo pelo CONTEÚDO (não pelo nome): PDF, JPEG ou PNG. Qualquer outra coisa: null.
function tipoDeArquivo(buf) {
  const b = Buffer.from(buf.slice(0, 8));
  if (b.slice(0, 5).toString('latin1') === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  return null;
}

// Mês e ano de hoje no horário de Brasília, como "10/2026".
function competenciaAtual(agora = new Date()) {
  const [ano, mes] = agora.toLocaleDateString('en-CA', { timeZone: FUSO }).split('-');
  return `${mes}/${ano}`;
}

function lerCampanha(corpo) {
  const erros = [];
  const titulo = String(corpo.titulo == null ? '' : corpo.titulo).trim() || 'Atualização de dados pessoais';
  const mensagem = String(corpo.mensagem == null ? '' : corpo.mensagem).trim();
  if (titulo.length < 3 || titulo.length > 80) erros.push('O título precisa ter de 3 a 80 letras.');
  if (mensagem.length > 400) erros.push('A mensagem pode ter no máximo 400 letras.');
  let prazo = null;
  const p = String(corpo.prazo == null ? '' : corpo.prazo).trim();
  if (p) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(p) ? new Date(`${p}T00:00:00.000Z`) : null;
    if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== p) erros.push('Prazo inválido.'); else prazo = d;
  }
  return { erros, campanha: { titulo, mensagem, prazo } };
}

// Para quem a atualização foi liberada: "todos" os colaboradores ativos ou só "selecionados" (uma lista de ids).
const MAX_ALVOS = 2000;

function lerPublico(corpo) {
  const publico = corpo.publico === 'selecionados' ? 'selecionados' : 'todos';
  if (publico === 'todos') return { erros: [], publico, ids: null };
  const ids = [...new Set((Array.isArray(corpo.colaboradorIds) ? corpo.colaboradorIds : []).filter((v) => v !== null && v !== undefined).map((v) => String(v).trim()).filter(Boolean))];
  if (ids.length === 0) return { erros: ['Escolha pelo menos um colaborador.'], publico, ids };
  if (ids.length > MAX_ALVOS) return { erros: [`Escolha no máximo ${MAX_ALVOS} colaboradores por vez.`], publico, ids };
  return { erros: [], publico, ids };
}

function alvosDe(campanha) {
  return campanha && Array.isArray(campanha.alvos) ? campanha.alvos : [];
}

// O colaborador faz parte desta atualização? (campanhas antigas, sem o campo "publico", valem para todos)
function fazParte(campanha, colaboradorId) {
  return campanha.publico !== 'selecionados' || alvosDe(campanha).includes(colaboradorId);
}

module.exports = {
  MAX_ALVOS, lerPublico, alvosDe, fazParte,
  MAX_COMPROVANTE, UFS, TIPO_COMPROVANTE,
  apenasDigitos, lerTelefone, formatarTelefone, lerEmail, lerCep, formatarCep,
  lerAtualizacao, tipoDeArquivo, competenciaAtual, lerCampanha,
};
