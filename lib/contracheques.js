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
function nomeDoArquivo(tipo, competencia, extensao = 'pdf') {
  const base = `${tipo} ${competencia}`.replace(/[\\/:*?"<>|\r\n]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${base}.${extensao}`;
}

function urlDoArquivo(driveId) {
  return `${PREFIXO_URL}${driveId}`;
}

// Se a url é de um arquivo guardado por este módulo, devolve o id do Drive; senão null.
function idDriveDaUrl(url) {
  const m = String(url || '').match(/^\/api\/contracheques\/arquivo\/([A-Za-z0-9_-]{10,100})$/);
  return m ? m[1] : null;
}

// Id do arquivo no Drive, a partir do endereço guardado no documento. Vale para os DOIS formatos que existem:
//  - o novo, privado do portal: /api/contracheques/arquivo/ID
//  - o antigo, link do Drive (aberto a "qualquer pessoa com o link"): https://drive.google.com/file/d/ID/view ou ...open?id=ID
// Devolve null se não for nenhum dos dois (aí não dá para ler nem apagar o arquivo, só o registro).
function idDriveDeQualquerUrl(url) {
  const proprio = idDriveDaUrl(url);
  if (proprio) return proprio;
  const m = String(url || '').match(/^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{10,100})/);
  return m ? m[1] : null;
}

// De onde veio o documento: 'portal' (privado), 'drive-antigo' (link do Drive, aberto a quem tiver o link) ou 'outro'.
function origemDoDocumento(url) {
  if (idDriveDaUrl(url)) return 'portal';
  return idDriveDeQualquerUrl(url) ? 'drive-antigo' : 'outro';
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Nome seguro para pasta do Drive (sem barras e símbolos que dão problema).
function limparNomePasta(texto) {
  return String(texto).replace(/[\\/:*?"<>|\r\n]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function nomeDaPasta(colaborador) {
  return limparNomePasta(`${colaborador.nome} - ${colaborador.matricula}`);
}

function nomePastaMes(mm) {
  return `${mm} - ${MESES[Number(mm) - 1]}`;
}

// "09/2026" -> { mes: "09", ano: "2026" }
function partesDaCompetencia(competencia) {
  const [mes, ano] = String(competencia).split('/');
  return { mes, ano };
}

// As pastas do Drive, de cima para baixo: Loja > Ano > Colaborador > Mês.
// "chave" identifica cada pasta no controle interno (para nunca criar a mesma pasta duas vezes).
function caminhoDaPasta({ loja, ano, colaborador, mes }) {
  return [
    { chave: `L|${loja}`, nome: limparNomePasta(loja) },
    { chave: `A|${loja}|${ano}`, nome: String(ano) },
    { chave: `C|${loja}|${ano}|${colaborador.id}`, nome: nomeDaPasta(colaborador) },
    { chave: `M|${loja}|${ano}|${colaborador.id}|${mes}`, nome: nomePastaMes(mes) },
  ];
}

const TODAS_AS_LOJAS = 'Todas as lojas';

function porNome(a, b) {
  return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
}

// Ordena as combinações "tipo + competência" que já existem, do envio mais recente para o mais antigo.
function ordenarCombos(grupos) {
  return grupos
    .map((g) => ({ tipo: g.tipo, competencia: g.competencia, enviados: g._count._all, ultimoEnvio: g._max.criadoEm }))
    .sort((a, b) => new Date(b.ultimoEnvio || 0) - new Date(a.ultimoEnvio || 0) || String(a.tipo).localeCompare(String(b.tipo)));
}

// Quem já recebeu e quem falta, loja por loja, para UM tipo e UMA competência.
// Só entram os colaboradores ATIVOS (quem saiu não vai receber). Vale para documentos enviados
// por qualquer um dos dois fluxos (tela antiga do .zip ou tela nova), porque olha os documentos registrados.
function montarHistorico({ colaboradores, documentos }) {
  const ativos = colaboradores.filter((c) => c.ativo);
  const idsAtivos = new Set(ativos.map((c) => c.id));
  const doc = new Map();
  for (const d of documentos) {
    const atual = doc.get(d.colaboradorId);
    if (!atual || new Date(d.criadoEm) > new Date(atual.criadoEm)) doc.set(d.colaboradorId, d);
  }
  const grupos = new Map();
  for (const c of ativos) {
    if (!grupos.has(c.loja)) grupos.set(c.loja, { loja: c.loja, enviados: [], faltam: [] });
    const g = grupos.get(c.loja);
    const d = doc.get(c.id);
    if (d) g.enviados.push({ id: c.id, nome: c.nome, quando: d.criadoEm });
    else g.faltam.push({ id: c.id, nome: c.nome });
  }
  const lojas = [...grupos.values()]
    .map((g) => ({ loja: g.loja, total: g.enviados.length + g.faltam.length, enviados: g.enviados.sort(porNome), faltam: g.faltam.sort(porNome) }))
    .sort((a, b) => a.loja.localeCompare(b.loja, 'pt-BR'));
  const soma = (campo) => lojas.reduce((n, l) => n + (campo === 'total' ? l.total : l[campo].length), 0);
  return {
    lojas,
    totais: { total: soma('total'), enviados: soma('enviados'), faltam: soma('faltam'), deInativos: documentos.filter((d) => !idsAtivos.has(d.colaboradorId)).length },
  };
}

function lerLoja(valor) {
  const s = String(valor || '').trim();
  return s.length >= 2 && s.length <= 60 ? s : null;
}

module.exports = { MAX_BYTES, PREFIXO_URL, ehPdf, lerCompetencia, lerTipo, nomeDoArquivo, urlDoArquivo, idDriveDaUrl, nomeDaPasta, limparNomePasta, nomePastaMes, partesDaCompetencia, caminhoDaPasta, TODAS_AS_LOJAS, ordenarCombos, montarHistorico, lerLoja, idDriveDeQualquerUrl, origemDoDocumento };
