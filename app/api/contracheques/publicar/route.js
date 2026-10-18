const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { MAX_BYTES, ehPdf, lerCompetencia, lerTipo, lerLoja } = require('../../../../lib/contracheques');
const { guardarDocumento } = require('../../../../lib/guardarDocumento');

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
    const loteId = String(form.get('loteId') || '');            // registro do envio no histórico (opcional)
    const lojaInformada = lerLoja(form.get('lojaPasta'));        // loja da pasta no Drive (se não vier, vale a do cadastro)

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

    const r = await guardarDocumento(prisma, { colaborador, tipo, competencia, buffer, lojaPasta: lojaInformada });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });

    // soma no registro do envio; se o registro não existir ou der erro, a publicação segue normalmente
    if (loteId) {
      try { await prisma.contrachequeLote.updateMany({ where: { id: loteId }, data: { [r.acao === 'criado' ? 'criados' : 'substituidos']: { increment: 1 } } }); }
      catch (err) { console.error('Não foi possível atualizar o registro do envio:', err); }
    }
    return Response.json({ ok: true, acao: r.acao });
  } catch (err) {
    console.error('Erro ao publicar contracheque:', err);
    return Response.json({ erro: 'Não foi possível publicar este arquivo.' }, { status: 500 });
  }
}

module.exports = { POST };
