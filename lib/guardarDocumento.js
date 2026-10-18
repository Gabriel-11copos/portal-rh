// Guarda um arquivo no Google Drive (Loja > Ano > Colaborador > Mês) e registra em "Documentos" do colaborador.
// É usado pelo envio de contracheques e pelo comprovante de residência, para os dois se comportarem igual.
// Se já existir o mesmo tipo e competência para a pessoa, o novo substitui o anterior.
// Devolve { ok: true, acao: 'criado' | 'substituido', url } ou { ok: false, status, erro }.

const drive = require('./driveContracheques');
const { nomeDoArquivo, urlDoArquivo, idDriveDaUrl, partesDaCompetencia } = require('./contracheques');

async function guardarDocumento(prisma, { colaborador, tipo, competencia, buffer, extensao = 'pdf', mimeType = 'application/pdf', lojaPasta, avisarColaborador = true }) {
  const { mes, ano } = partesDaCompetencia(competencia);
  const nomeArquivo = nomeDoArquivo(tipo, competencia, extensao);
  const dadosPasta = { loja: lojaPasta || colaborador.loja, ano, colaborador, mes };
  const enviar = async () => drive.enviarArquivo({ pastaId: await drive.garantirCaminho(prisma, dadosPasta), nome: nomeArquivo, buffer, mimeType });

  // grava no Drive primeiro: se o Drive falhar, nada é registrado em "Documentos"
  let driveId;
  try {
    try {
      driveId = await enviar();
    } catch (err) {
      // a pasta guardada não existe mais no Drive (alguém apagou): esquece e tenta uma vez de novo
      if (drive.codigoDoErro(err) !== 404) throw err;
      await drive.esquecerCaminho(prisma, dadosPasta);
      driveId = await enviar();
    }
  } catch (err) {
    console.error('Erro ao gravar documento no Drive:', err);
    return { ok: false, status: 502, erro: drive.explicar(err) };
  }

  const url = urlDoArquivo(driveId);
  const existente = await prisma.documento.findFirst({ where: { colaboradorId: colaborador.id, tipo, competencia } });
  if (!existente) {
    await prisma.documento.create({ data: { colaboradorId: colaborador.id, tipo, competencia, url, nomeArquivo, vistoColaborador: !avisarColaborador } });
    return { ok: true, acao: 'criado', url };
  }

  await prisma.documento.update({ where: { id: existente.id }, data: { url, nomeArquivo, vistoColaborador: !avisarColaborador } });
  // se o anterior também era nosso, apaga o arquivo antigo do Drive para não acumular
  const antigo = idDriveDaUrl(existente.url);
  if (antigo && antigo !== driveId) {
    try { await drive.apagarArquivo(antigo); } catch (err) { console.error('Não foi possível apagar o arquivo antigo do Drive:', err); }
  }
  return { ok: true, acao: 'substituido', url };
}

module.exports = { guardarDocumento };
