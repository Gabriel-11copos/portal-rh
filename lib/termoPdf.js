// PDF do termo de não optante. Desenha o TEXTO QUE A PESSOA ACEITOU (guardado no registro), linha por linha.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const A4 = [595.28, 841.89];
const MARGEM = 56;

async function gerarPdfDoTermo(texto) {
  const doc = await PDFDocument.create();
  doc.setTitle('Termo de não optante pelo vale-transporte'); doc.setProducer('Portal do Colaborador'); doc.setCreator('Portal do Colaborador');
  const normal = await doc.embedFont(StandardFonts.Helvetica); const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  // a fonte padrão do PDF não tem todas as letras do mundo: o que não existir vira "?" (nunca derruba a geração)
  const seguro = (t) => [...String(t).replace(/[\u00a0\u202f\u2009]/g, ' ')].map((ch) => { try { normal.encodeText(ch); return ch; } catch { return '?'; } }).join('');
  const largura = A4[0] - MARGEM * 2;
  let pagina = doc.addPage(A4); let y = A4[1] - MARGEM;
  const garantir = (altura) => { if (y - altura < MARGEM) { pagina = doc.addPage(A4); y = A4[1] - MARGEM; } };
  const quebrar = (t, fonte, tam) => {
    const palavras = seguro(t).split(/\s+/).filter(Boolean); const linhas = []; let atual = '';
    for (const p of palavras) { const teste = atual ? `${atual} ${p}` : p; if (fonte.widthOfTextAtSize(teste, tam) <= largura || !atual) atual = teste; else { linhas.push(atual); atual = p; } }
    if (atual) linhas.push(atual); return linhas;
  };
  const escrever = (t, { fonte = normal, tam = 11, folga = 4, cor = rgb(0, 0, 0), centro = false } = {}) => {
    for (const linha of quebrar(t, fonte, tam)) {
      garantir(tam + folga);
      const x = centro ? MARGEM + (largura - fonte.widthOfTextAtSize(linha, tam)) / 2 : MARGEM;
      pagina.drawText(linha, { x, y: y - tam, size: tam, font: fonte, color: cor }); y -= tam + folga;
    }
  };
  const linhas = String(texto).split('\n');
  let cabecalho = true;
  linhas.forEach((linha, i) => {
    if (i === 0) { escrever(linha, { fonte: negrito, tam: 14, folga: 10, centro: true }); y -= 8; return; }
    if (!linha.trim()) { if (i > 1) cabecalho = false; y -= 8; return; }
    if (linha.startsWith('Aceite digital')) { y -= 6; escrever(linha, { tam: 9, cor: rgb(0.35, 0.35, 0.35) }); return; }
    const m = cabecalho && linha.match(/^([A-ZÀ-Ý()\/ ]+): (.*)$/);
    if (m) {
      garantir(15); const rotulo = seguro(`${m[1]}: `); pagina.drawText(rotulo, { x: MARGEM, y: y - 11, size: 11, font: negrito });
      const resto = quebrar(m[2], normal, 11); const desloc = negrito.widthOfTextAtSize(rotulo, 11);
      pagina.drawText(resto[0] || '', { x: MARGEM + desloc, y: y - 11, size: 11, font: normal }); y -= 15;
      for (const extra of resto.slice(1)) { garantir(15); pagina.drawText(extra, { x: MARGEM + desloc, y: y - 11, size: 11, font: normal }); y -= 15; }
      return;
    }
    escrever(linha, { tam: 11, folga: 5 });
  });
  return Buffer.from(await doc.save());
}

module.exports = { gerarPdfDoTermo };
