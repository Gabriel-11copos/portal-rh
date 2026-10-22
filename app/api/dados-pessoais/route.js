const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const { MAX_COMPROVANTE, TIPO_COMPROVANTE, lerAtualizacao, tipoDeArquivo, competenciaAtual, fazParte } = require('../../../lib/dadosPessoais');
const { guardarDocumento } = require('../../../lib/guardarDocumento');
const { creditar } = require('../../../lib/moedas');

// O colaborador envia os dados pessoais e o comprovante de residência da atualização liberada pelo RH.
// O comprovante vai para o Drive (Loja > Ano > Colaborador > Mês), privado, e aparece também em "Documentos".
async function POST(req) {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const campanha = await prisma.campanhaDados.findFirst({ where: { ativa: true }, orderBy: { criadaEm: 'desc' } });
    if (!campanha || !fazParte(campanha, sessao.id)) return Response.json({ erro: 'Não há atualização de dados liberada para você no momento.' }, { status: 409 });

    const form = await req.formData();
    const { erros, dados } = lerAtualizacao(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    const registro = await prisma.atualizacaoDados.findFirst({ where: { campanhaId: campanha.id, colaboradorId: sessao.id } });
    let comprovanteUrl = registro && registro.origem === 'colaborador' ? registro.comprovanteUrl : null;

    const arquivo = form.get('comprovante');
    const enviouArquivo = arquivo && typeof arquivo !== 'string' && typeof arquivo.arrayBuffer === 'function' && arquivo.size > 0;
    if (!enviouArquivo && !comprovanteUrl) return Response.json({ erro: 'Anexe o comprovante de residência (PDF ou foto).' }, { status: 400 });

    if (enviouArquivo) {
      if (arquivo.size > MAX_COMPROVANTE) return Response.json({ erro: 'O comprovante passa de 4 MB. Envie um arquivo menor.' }, { status: 413 });
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      const tipo = tipoDeArquivo(buffer);
      if (!tipo) return Response.json({ erro: 'O comprovante precisa ser um PDF ou uma foto (JPG ou PNG).' }, { status: 400 });

      const colaborador = await prisma.colaborador.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, matricula: true, loja: true } });
      if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

      const r = await guardarDocumento(prisma, {
        colaborador, tipo: TIPO_COMPROVANTE, competencia: competenciaAtual(), buffer,
        extensao: tipo.ext, mimeType: tipo.mime, avisarColaborador: false,   // ele mesmo enviou: sem "novidade" para ele
      });
      if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
      comprovanteUrl = r.url;
    }

    const campos = { origem: 'colaborador', ...dados, comprovanteUrl, baixaPor: null, baixaMotivo: null };
    if (registro) {
      await prisma.atualizacaoDados.update({ where: { id: registro.id }, data: campos });
    } else {
      try {
        await prisma.atualizacaoDados.create({ data: { campanhaId: campanha.id, colaboradorId: sessao.id, ...campos } });
      } catch (err) {
        // clique duplo: o outro envio já criou; atualiza com estes dados
        const outro = await prisma.atualizacaoDados.findFirst({ where: { campanhaId: campanha.id, colaboradorId: sessao.id } });
        if (!outro) throw err;
        await prisma.atualizacaoDados.update({ where: { id: outro.id }, data: campos });
      }
    }

    // o e-mail do cadastro acompanha o que ele informou (se falhar, os dados da atualização já estão salvos)
    try { await prisma.colaborador.update({ where: { id: sessao.id }, data: { email: dados.email } }); }
    catch (err) { console.error('Não foi possível atualizar o e-mail do cadastro:', err); }

    // moedas: concluir a atualização de dados rende (uma vez por campanha; só vale com o programa ligado e um valor definido)
    await creditar(prisma, { colaboradorId: sessao.id, origem: 'atualizou_dados', referencia: campanha.id, descricao: 'Atualizou os dados pessoais' });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar a atualização de dados:', err);
    return Response.json({ erro: 'Não foi possível salvar agora. Tente de novo.' }, { status: 500 });
  }
}

module.exports = { POST };
