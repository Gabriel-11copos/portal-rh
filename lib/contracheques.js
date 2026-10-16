// Distribuição de contracheques (e outros documentos pessoais em PDF).
// O PDF é lido no navegador do RH para saber de quem é; aqui no servidor só se valida e se guarda.
// Os arquivos ficam PRIVADOS no Google Drive e só abrem para o dono (ou o RH), com login no portal.

const MAX_BYTES = 4 * 1024 * 1024;   // o Vercel recusa envios acima de ~4,5 MB; um contracheque tem poucas dezenas de KB
const PREFIXO_URL = '/api/contracheques/arquivo/';

// O arquivo precisa começar com "%PDF" (e não ser outra coisa com nome de PDF).
function ehPdf(buf) {
  return Buffer.from(buf.slice(0, 5)).toString('latin1') === '%PDF-';
}

function lerCompetencia(valor) {
  const s = String(valor || '').trim();
  const m = s.match(/^(\d{2})\/(\d{4})$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return null;
  return s;
}

function lerTipo(valor) {
  const s = String(valor || '').trim();
  return s.length >= 2 && s.length <= 40 ? s : null;
}

// Nome do arquivo dentro da pasta da pessoa: "Contracheque 08-2026.pdf"
function nomeDoArquivo(tipo, competencia) {
  const base = `${tipo} ${competencia}`.replace(/[\\/:*?"<>|\r\n]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${base}.pdf`;
}

function urlDoArquivo(driveId) {
  return `${PREFIXO_URL}${driveId}`;
}

// Se a url é de um arquivo guardado por este módulo, devolve o id do Drive; senão null.
function idDriveDaUrl(url) {
  const m = String(url || '').match(/^\/api\/contracheques\/arquivo\/([A-Za-z0-9_-]{10,100})$/);
  return m ? m[1] : null;
}

function nomeDaPasta(colaborador) {
  return `${colaborador.nome} - ${colaborador.matricula}`.replace(/[\\/:*?"<>|\r\n]+/g, '-').slice(0, 120);
}

module.exports = { MAX_BYTES, PREFIXO_URL, ehPdf, lerCompetencia, lerTipo, nomeDoArquivo, urlDoArquivo, idDriveDaUrl, nomeDaPasta };
