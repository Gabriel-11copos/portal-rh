// Guias e treinamentos: páginas montadas em blocos (texto, imagem, arquivo e link), na ordem que o RH escolher.
// Este arquivo só decide o que é válido; quem grava no banco são as rotas.

const MAX_BYTES = 4 * 1024 * 1024;   // o Vercel recusa envios acima de ~4,5 MB, então o limite é 4 MB
const MAX_BLOCOS = 60;

const MIME_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MIME_ARQUIVO = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};
const MIME_POR_EXTENSAO = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  ...Object.fromEntries(Object.entries(MIME_ARQUIVO).map(([mime, ext]) => [ext, mime])),
};

function extensao(nome) {
  const m = String(nome || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

// Descobre o tipo permitido de um arquivo enviado. Devolve { tipoMime, classe } ou null se não for permitido.
// SVG e qualquer coisa fora da lista são recusados.
function classificarMidia(mime, nome) {
  let m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (!MIME_IMAGEM.includes(m) && !MIME_ARQUIVO[m]) m = MIME_POR_EXTENSAO[extensao(nome)] || '';
  if (MIME_IMAGEM.includes(m)) return { tipoMime: m, classe: 'imagem' };
  if (MIME_ARQUIVO[m]) return { tipoMime: m, classe: 'arquivo' };
  return null;
}

// Confere o início do arquivo para ver se ele é mesmo o que diz ser (imagens e PDF).
function assinaturaConfere(tipoMime, buf) {
  const b = Buffer.from(buf.slice(0, 16));
  const ini = (...bytes) => bytes.every((v, i) => b[i] === v);
  if (tipoMime === 'image/jpeg') return ini(0xff, 0xd8, 0xff);
  if (tipoMime === 'image/png') return ini(0x89, 0x50, 0x4e, 0x47);
  if (tipoMime === 'image/gif') return ini(0x47, 0x49, 0x46, 0x38);
  if (tipoMime === 'image/webp') return b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP';
  if (tipoMime === 'application/pdf') return b.slice(0, 4).toString('latin1') === '%PDF';
  return true;
}

function urlValida(u) {
  try {
    const x = new URL(String(u || '').trim());
    return x.protocol === 'http:' || x.protocol === 'https:';
  } catch {
    return false;
  }
}

function nomeSeguroDoArquivo(nome) {
  return String(nome || 'arquivo').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim().slice(0, 120) || 'arquivo';
}

// Limpa e valida a lista de blocos. Só passam os campos conhecidos de cada tipo.
function limparBlocos(brutos) {
  const erros = [];
  if (!Array.isArray(brutos)) return { blocos: [], erros: ['Os blocos precisam ser uma lista.'] };
  if (brutos.length > MAX_BLOCOS) return { blocos: [], erros: [`Um guia pode ter no máximo ${MAX_BLOCOS} blocos.`] };

  const blocos = [];
  brutos.forEach((b, i) => {
    const n = i + 1;
    const tipo = b && b.tipo;
    if (tipo === 'texto') {
      const texto = String(b.texto || '').trim();
      if (!texto) erros.push(`Bloco ${n}: o texto está vazio.`);
      else if (texto.length > 5000) erros.push(`Bloco ${n}: o texto passa de 5000 letras.`);
      else blocos.push({ tipo, texto });
    } else if (tipo === 'imagem') {
      const midiaId = String(b.midiaId || '').trim();
      const legenda = String(b.legenda || '').trim();
      if (!midiaId || midiaId.length > 40) erros.push(`Bloco ${n}: falta enviar a imagem.`);
      else if (legenda.length > 160) erros.push(`Bloco ${n}: a legenda passa de 160 letras.`);
      else blocos.push({ tipo, midiaId, legenda });
    } else if (tipo === 'arquivo') {
      const nome = String(b.nome || '').trim();
      const midiaId = String(b.midiaId || '').trim();
      const url = String(b.url || '').trim();
      if (!nome || nome.length > 120) erros.push(`Bloco ${n}: dê um nome ao arquivo (até 120 letras).`);
      else if (!midiaId && !urlValida(url)) erros.push(`Bloco ${n}: envie o arquivo ou cole um link que comece com http.`);
      else if (midiaId && midiaId.length > 40) erros.push(`Bloco ${n}: arquivo inválido.`);
      else blocos.push(midiaId ? { tipo, nome, midiaId } : { tipo, nome, url });
    } else if (tipo === 'link') {
      const texto = String(b.texto || '').trim();
      const url = String(b.url || '').trim();
      if (!texto || texto.length > 80) erros.push(`Bloco ${n}: o texto do botão precisa ter de 1 a 80 letras.`);
      else if (!urlValida(url)) erros.push(`Bloco ${n}: o link precisa começar com http.`);
      else blocos.push({ tipo, texto, url });
    } else {
      erros.push(`Bloco ${n}: tipo desconhecido.`);
    }
  });
  return { blocos: erros.length ? [] : blocos, erros };
}

// Valida os campos do guia (título, descrição, categoria, publicado) e os blocos.
function lerGuia(corpo) {
  const erros = [];
  const titulo = String(corpo.titulo || '').trim();
  const descricao = String(corpo.descricao || '').trim();
  const categoria = String(corpo.categoria || 'Geral').trim() || 'Geral';
  if (titulo.length < 3 || titulo.length > 80) erros.push('O título precisa ter de 3 a 80 letras.');
  if (descricao.length > 200) erros.push('A descrição pode ter no máximo 200 letras.');
  if (categoria.length < 2 || categoria.length > 40) erros.push('A categoria precisa ter de 2 a 40 letras.');
  const r = limparBlocos(corpo.blocos);
  erros.push(...r.erros);
  if (r.erros.length === 0 && r.blocos.length === 0) erros.push('Adicione pelo menos um bloco ao guia.');
  return { guia: { titulo, descricao, categoria, blocos: r.blocos, ativo: !!corpo.ativo }, erros };
}

function idsDeMidia(blocos) {
  return [...new Set((Array.isArray(blocos) ? blocos : []).map((b) => b && b.midiaId).filter(Boolean))];
}

module.exports = {
  MAX_BYTES, MAX_BLOCOS, MIME_IMAGEM, classificarMidia, assinaturaConfere, urlValida,
  nomeSeguroDoArquivo, limparBlocos, lerGuia, idsDeMidia,
};
