const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { MAX_BYTES, ehPdf, lerCompetencia, lerTipo, lerLoja, nomeDoArquivo, urlDoArquivo, idDriveDaUrl, partesDaCompetencia } = require('../../../../lib/contracheques');
const drive = require('../../../../lib/driveContracheques');

// Só RH. Recebe UM PDF já identificado (de quem é, tipo e competência), guarda no Drive (privado)
// e registra em "Documentos" do colaborador. Se já existir o mesmo tipo e competência, substitui.
// Se vier o código de um registro de envio (loteId), soma este documento nele.
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const form = await req.formData();
    const arquivo = form.get('arquivo');
    const colaboradorId = String(form.get('colaboradorId') || '');
    const tipo = lerTipo(form.get('tipo'));
    const competencia = lerCompetencia(form.get('competencia'));
    const loteId = String(form.get('loteId') || '');   // registro do envio no histórico (opcional)
    const lojaInformada = lerLoja(form.get('lojaPasta')); // loja da pasta no Drive (se não vier, vale a do cadastro)

    if (!tipo) return Response.json({ erro: 'Informe o tipo do documento (ex: Contracheque).' }, { status: 400 });
    if (!competencia) return Response.json({ erro: 'Informe a competência no formato MM/AAAA (ex: 08/2026).' }, { status: 400 });
    if (!arquivo || typeof arquivo === 'string' || typeof arquivo.arrayBuffer !== 'function') {
      return Response.json({ erro: 'Escolha o arquivo PDF.' }, { status: 400 });
    }
    if (arquivo.size > MAX_BYTES) return Response.json({ erro: 'O PDF passa de 4 MB.' }, { status: 413 });

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    if (buffer.length === 0 || !ehPdf(buffer)) return Response.json({ erro: 'O arquivo não é um PDF válido.' }, { status: 400 });

    const colaborador = await prisma.colaborador.findUnique({
      where: { id: colaboradorId },
      select: { id: true, nome: true, matricula: true, loja: true },
    });
    if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

    // guarda no Drive (Loja > Ano > Colaborador > Mês) primeiro: se o Drive falhar, nada é registrado em "Documentos"
    const { mes, ano } = partesDaCompetencia(competencia);
    const dadosPasta = { loja: lojaInformada || colaborador.loja, ano, colaborador, mes };
    const enviarNaPasta = async () => drive.enviarPdf({ pastaId: await drive.garantirCaminho(prisma, dadosPasta), nome: nomeDoArquivo(tipo, competencia), buffer });
    let driveId;
    try {
      try {
        driveId = await enviarNaPasta();
      } catch (err) {
        // a pasta guardada não existe mais no Drive (alguém apagou): esquece e tenta uma vez de novo
        if (drive.codigoDoErro(err) !== 404) throw err;
        await drive.esquecerCaminho(prisma, dadosPasta);
        driveId = await enviarNaPasta();
      }
    } catch (err) {
      console.error('Erro ao gravar contracheque no Drive:', err);
      return Response.json({ erro: drive.explicar(err) }, { status: 502 });
    }

    const nomeArquivo = nomeDoArquivo(tipo, competencia);
    const url = urlDoArquivo(driveId);

    // soma no registro do envio; se o registro não existir ou der erro, a publicação segue normalmente
    const somarNoRegistro = async (campo) => {
      if (!loteId) return;
      try { await prisma.contrachequeLote.updateMany({ where: { id: loteId }, data: { [campo]: { increment: 1 } } }); }
      catch (err) { console.error('Não foi possível atualizar o registro do envio:', err); }
    };
    const existente = await prisma.documento.findFirst({ where: { colaboradorId: colaborador.id, tipo, competencia } });

    if (!existente) {
      await prisma.documento.create({
        data: { colaboradorId: colaborador.id, tipo, competencia, url, nomeArquivo, vistoColaborador: false },
      });
      await somarNoRegistro('criados');
      return Response.json({ ok: true, acao: 'criado' });
    }

    await prisma.documento.update({ where: { id: existente.id }, data: { url, nomeArquivo, vistoColaborador: false } });
    // se o anterior também era nosso, apaga o arquivo antigo do Drive para não acumular
    const antigo = idDriveDaUrl(existente.url);
    if (antigo && antigo !== driveId) {
      try { await drive.apagarArquivo(antigo); } catch (err) { console.error('Não foi possível apagar o arquivo antigo do Drive:', err); }
    }
    await somarNoRegistro('substituidos');
    return Response.json({ ok: true, acao: 'substituido' });
  } catch (err) {
    console.error('Erro ao publicar contracheque:', err);
    return Response.json({ erro: 'Não foi possível publicar este arquivo.' }, { status: 500 });
  }
}

module.exports = { POST };
