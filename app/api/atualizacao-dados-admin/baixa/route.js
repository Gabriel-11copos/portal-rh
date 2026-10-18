const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Só RH. Dá baixa na atualização de um colaborador (por exemplo, ele falou com o RH): o sistema para de avisar.
// Também desfaz uma baixa dada por engano. Não mexe em quem já atualizou os dados sozinho.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { colaboradorId, acao, motivo } = await req.json();
    if (acao !== 'dar' && acao !== 'desfazer') return Response.json({ erro: 'Ação inválida.' }, { status: 400 });

    const campanha = await prisma.campanhaDados.findFirst({ where: { ativa: true }, orderBy: { criadaEm: 'desc' } });
    if (!campanha) return Response.json({ erro: 'Não há atualização liberada.' }, { status: 409 });

    const colaborador = await prisma.colaborador.findUnique({ where: { id: String(colaboradorId || '') }, select: { id: true } });
    if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

    const existente = await prisma.atualizacaoDados.findFirst({ where: { campanhaId: campanha.id, colaboradorId: colaborador.id } });

    if (acao === 'desfazer') {
      if (!existente || existente.origem !== 'baixa_rh') return Response.json({ erro: 'Só dá para desfazer uma baixa dada pelo RH.' }, { status: 409 });
      await prisma.atualizacaoDados.deleteMany({ where: { id: existente.id, origem: 'baixa_rh' } });
      return Response.json({ ok: true });
    }

    const texto = String(motivo == null ? '' : motivo).trim();
    if (texto.length > 200) return Response.json({ erro: 'O motivo pode ter no máximo 200 letras.' }, { status: 400 });
    if (existente) {
      return Response.json({ erro: existente.origem === 'colaborador' ? 'Este colaborador já atualizou os dados.' : 'Este colaborador já tem baixa.' }, { status: 409 });
    }
    try {
      await prisma.atualizacaoDados.create({
        data: { campanhaId: campanha.id, colaboradorId: colaborador.id, origem: 'baixa_rh', baixaPor: typeof sessao.nome === 'string' ? sessao.nome : null, baixaMotivo: texto || null },
      });
    } catch (err) {
      // clique duplo: a baixa (ou a atualização) já existe
      const outro = await prisma.atualizacaoDados.findFirst({ where: { campanhaId: campanha.id, colaboradorId: colaborador.id } });
      if (!outro) throw err;
      return Response.json({ erro: 'Este colaborador já foi atualizado ou já tem baixa.' }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao dar baixa na atualização de dados:', err);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { POST };
