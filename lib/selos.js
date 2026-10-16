// Selos (conquistas) do colaborador.
// - AUTOMÁTICOS (calculados na hora, sem guardar nada): tempo de casa e aniversário do mês.
// - CONCEDIDOS (guardados no banco): presença e reconhecimentos, dados pelo RH.
// Datas de calendário (admissão, nascimento) são guardadas à meia-noite UTC, por isso são lidas em UTC.

const FUSO = 'America/Sao_Paulo';

// Tempo de casa: a escada segue o caminho da cerveja, do ingrediente à lenda.
const SELOS_TEMPO = [
  { meses: 3, codigo: 'tempo-3m', nome: 'Malte', icone: '🌾', descricao: '3 meses de casa' },
  { meses: 6, codigo: 'tempo-6m', nome: 'Lúpulo', icone: '🌿', descricao: '6 meses de casa' },
  { meses: 12, codigo: 'tempo-1a', nome: 'Levedura', icone: '🧪', descricao: '1 ano de casa' },
  { meses: 24, codigo: 'tempo-2a', nome: 'Maturação', icone: '🕰️', descricao: '2 anos de casa' },
  { meses: 36, codigo: 'tempo-3a', nome: 'Barril', icone: '🛢️', descricao: '3 anos de casa' },
  { meses: 60, codigo: 'tempo-5a', nome: 'Mestre Cervejeiro', icone: '👑', descricao: '5 anos de casa' },
  { meses: 120, codigo: 'tempo-10a', nome: 'Lenda da Casa', icone: '💎', descricao: '10 anos de casa' },
];

const SELO_ANIVERSARIO = { codigo: 'aniversario', nome: 'Brinde', icone: '🍻', descricao: 'Aniversariante do mês' };

function hojeBrasilia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
}

// Meses completos de casa. Quem foi admitido num dia 31 só completa o mês quando o dia chega.
function mesesDeCasa(dataAdmissao, hojeISO) {
  if (!dataAdmissao) return null;
  const d = new Date(dataAdmissao);
  if (isNaN(d)) return null;
  const [ah, mh, dh] = hojeISO.split('-').map(Number);
  const meses = (ah - d.getUTCFullYear()) * 12 + (mh - (d.getUTCMonth() + 1)) - (dh < d.getUTCDate() ? 1 : 0);
  return meses < 0 ? 0 : meses;
}

function conquistasDeTempo(dataAdmissao, hojeISO) {
  const meses = mesesDeCasa(dataAdmissao, hojeISO);
  if (meses === null) return null;
  const niveis = SELOS_TEMPO.map((s) => ({ ...s, conquistado: meses >= s.meses, faltam: Math.max(0, s.meses - meses) }));
  return { meses, niveis, proximo: niveis.find((n) => !n.conquistado) || null };
}

// "Brinde": vale durante o mês inteiro do aniversário.
function emMesDeAniversario(dataNascimento, hojeISO) {
  if (!dataNascimento) return false;
  const d = new Date(dataNascimento);
  if (isNaN(d)) return false;
  return d.getUTCMonth() + 1 === Number(hojeISO.slice(5, 7));
}

// ---------- listas de CPF (para dar um selo a várias pessoas de uma vez)

function cpfValido(cpf) {
  const s = String(cpf || '').replace(/\D/g, '');
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  const digito = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(s[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(s[9]) && digito(10) === Number(s[10]);
}

// Acha todos os CPFs de um texto (colado ou lido de planilha), com ou sem pontuação.
function extrairCpfs(texto) {
  const achados = new Set();
  const re = /(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)/g;
  for (const m of String(texto || '').matchAll(re)) achados.add(m[1].replace(/\D/g, ''));
  return [...achados];
}

function validarPeriodoRef(ref) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(ref || ''));
}

function slugDoNome(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'selo';
}

// Decide quem recebe o selo. Colaboradores vêm por CPF e/ou por id; inativos não recebem;
// quando há mês de referência (presença), quem já recebeu aquele mês é pulado.
function planejarConcessao({ colaboradores, cpfs, ids, periodoRef, jaConcedidos }) {
  const porCpf = new Map(colaboradores.map((c) => [c.matricula, c]));
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const alvo = new Map();
  const naoEncontrados = [];
  const cpfsInvalidos = [];

  for (const cpf of cpfs || []) {
    if (!cpfValido(cpf)) { cpfsInvalidos.push(cpf); continue; }
    const c = porCpf.get(cpf);
    if (!c) { naoEncontrados.push(cpf); continue; }
    alvo.set(c.id, c);
  }
  for (const id of ids || []) {
    const c = porId.get(id);
    if (c) alvo.set(c.id, c);
  }

  const jaTemNoPeriodo = new Set(periodoRef ? (jaConcedidos || []).map((g) => g.colaboradorId) : []);
  const novos = [];
  const jaTem = [];
  const inativos = [];
  for (const c of alvo.values()) {
    if (!c.ativo) inativos.push(c);
    else if (jaTemNoPeriodo.has(c.id)) jaTem.push(c);
    else novos.push(c);
  }
  return { novos, jaTem, inativos, naoEncontrados, cpfsInvalidos };
}

const GRUPOS = ['presenca', 'reconhecimento'];

// Valida os campos de um selo (usado na criação e na edição).
function lerCamposDoSelo(corpo, parcial) {
  const saida = {};
  const erros = [];
  if (!parcial || corpo.nome !== undefined) {
    const nome = String(corpo.nome || '').trim();
    if (nome.length < 2 || nome.length > 40) erros.push('O nome precisa ter de 2 a 40 letras.');
    else saida.nome = nome;
  }
  if (!parcial || corpo.descricao !== undefined) {
    const descricao = String(corpo.descricao || '').trim();
    if (descricao.length > 120) erros.push('A descrição pode ter no máximo 120 letras.');
    else saida.descricao = descricao;
  }
  if (!parcial || corpo.icone !== undefined) {
    const icone = String(corpo.icone || '').trim();
    if (!icone || [...icone].length > 4) erros.push('Escolha um emoji como ícone.');
    else saida.icone = icone;
  }
  if (!parcial) {
    if (!GRUPOS.includes(corpo.grupo)) erros.push('Escolha o grupo do selo.');
    else saida.grupo = corpo.grupo;
  }
  return { saida, erros };
}

module.exports = {
  GRUPOS_DE_SELO: GRUPOS,
  lerCamposDoSelo,
  SELOS_TEMPO,
  SELO_ANIVERSARIO,
  hojeBrasilia,
  mesesDeCasa,
  conquistasDeTempo,
  emMesDeAniversario,
  cpfValido,
  extrairCpfs,
  validarPeriodoRef,
  slugDoNome,
  planejarConcessao,
};
