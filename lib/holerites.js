const { PDFDocument } = require('pdf-lib');
// Importa direto do arquivo interno (não o pacote raiz) — a raiz do pdf-parse
// tem um código de "autoteste" que dispara sozinho durante o build do Vercel
// e quebra tudo. O arquivo interno faz a mesma coisa, sem esse problema.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// Mesmo mapeamento usado na importação original dos colaboradores.
const MAPA_LOJA = {
  'BREWTECO TERRACO BAR E RESTAURANTE LTDA': 'Brewteco Terraço',
  'BREWTECO GAVEA BAR E RESTAURANTE LTDA': 'Brewteco Gávea',
  'BREWTECO ROSAS BAR E RESTAURANTE LTDA': 'Brewteco Rosas',
  'BREWTECO TIJUCA BAR E RESTAURANTE LTDA': 'Brewteco Tijuca',
  'ONZE COPOS PARTICIPACOES S.A.': 'Onze Copos (Administrativo)',
  'BREWTECO LARANJEIRAS BAR E RESTAURANTE LTDA': 'Brewteco Laranjeiras',
  'BAR MARISQUEIRA DO LEBLON LTDA': 'Marisqueira do Leblon',
  'CERVEJARIA BREWTECO LTDA': 'Cervejaria Brewteco (Fábrica)',
  'BREWTECO MORRO DA URCA BAR E RESTAURANTE LTDA': 'Brewteco Morro da Urca',
  'ONZE COPOS EVENTOS LTDA': 'Onze Copos Eventos',
};

function normalizar(txt) {
  return (txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrai o texto de cada página usando o pdf-parse clássico (v1), que é puro
// CommonJS e não depende de pacotes nativos — evita os problemas de build que
// versões mais novas ou o pdfjs-dist puro causam em ambiente serverless.
async function extrairTextoPorPagina(bufferPdf) {
  const paginas = [];
  await pdfParse(bufferPdf, {
    pagerender: (pageData) =>
      pageData.getTextContent().then((tc) => {
        let linhaAtualY = null;
        let linhas = [];
        let linhaAtual = [];
        for (const item of tc.items) {
          const y = Math.round(item.transform[5]);
          if (linhaAtualY === null || Math.abs(y - linhaAtualY) > 2) {
            if (linhaAtual.length) linhas.push(linhaAtual.join(' '));
            linhaAtual = [];
            linhaAtualY = y;
          }
          linhaAtual.push(item.str);
        }
        if (linhaAtual.length) linhas.push(linhaAtual.join(' '));
        const texto = linhas.join('\n');
        paginas.push(texto);
        return texto;
      }),
  });
  return paginas;
}

// Numa página do contracheque, o nome (+ cargo grudado) vem seguido do código
// interno de 6 dígitos no fim da linha. Ex: "FULANO DA SILVA Garçom   000466".
function extrairNomeDaPagina(textoPagina) {
  const linhas = textoPagina.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const linha of linhas) {
    if (/Demonstrativo de Pagamento/i.test(linha)) continue;
    const m = linha.match(/^(.+?)\s+(?<!\d)(\d{6})$/);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairLojaDaPagina(textoPagina) {
  const linhas = textoPagina.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const linha of linhas) {
    const norm = normalizar(linha);
    for (const chave of Object.keys(MAPA_LOJA)) {
      if (norm === normalizar(chave)) return MAPA_LOJA[chave];
    }
  }
  return null;
}

// Processa o PDF consolidado inteiro: identifica cada colaborador por página,
// agrupa páginas consecutivas da mesma pessoa, casa com o cadastro (nome + loja)
// e devolve um PDF individual (bytes) por colaborador encontrado.
async function processarContracheques(bufferPdf, colaboradoresDaBase) {
  const candidatosPorLoja = {};
  for (const c of colaboradoresDaBase) {
    const key = c.loja;
    if (!candidatosPorLoja[key]) candidatosPorLoja[key] = [];
    candidatosPorLoja[key].push({ ...c, nomeNorm: normalizar(c.nome) });
  }

  const paginas = await extrairTextoPorPagina(bufferPdf);

  const grupos = [];
  for (let i = 0; i < paginas.length; i++) {
    const blob = extrairNomeDaPagina(paginas[i]);
    const loja = extrairLojaDaPagina(paginas[i]);
    if (!blob) {
      grupos.push({ chave: `pagina-sem-nome-${i}`, colaborador: null, blob: '(não identificado)', loja, paginas: [i] });
      continue;
    }
    const blobNorm = normalizar(blob);
    const candidatos = (candidatosPorLoja[loja] || []).filter((c) => blobNorm.startsWith(c.nomeNorm));
    const colaborador = candidatos.length === 1 ? candidatos[0] : null;
    const chave = colaborador ? colaborador.cpf : `semmatch-${blobNorm}`;

    const anterior = grupos[grupos.length - 1];
    if (anterior && anterior.chave === chave) {
      anterior.paginas.push(i);
    } else {
      grupos.push({ chave, colaborador, blob, loja, paginas: [i], ambiguo: candidatos.length > 1 });
    }
  }

  const original = await PDFDocument.load(bufferPdf);
  const distribuidos = [];
  const naoDistribuidos = [];

  for (const g of grupos) {
    if (!g.colaborador) {
      naoDistribuidos.push({ nomeDetectado: g.blob, lojaDetectada: g.loja, paginas: g.paginas.map((p) => p + 1), ambiguo: !!g.ambiguo });
      continue;
    }
    const novo = await PDFDocument.create();
    const copiadas = await novo.copyPages(original, g.paginas);
    copiadas.forEach((p) => novo.addPage(p));
    const bytes = await novo.save();
    distribuidos.push({ colaboradorId: g.colaborador.id, nome: g.colaborador.nome, cpf: g.colaborador.cpf, bytes: Buffer.from(bytes) });
  }

  return { distribuidos, naoDistribuidos };
}

module.exports = { processarContracheques, normalizar, MAPA_LOJA };