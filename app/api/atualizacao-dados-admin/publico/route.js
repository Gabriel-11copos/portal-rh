const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { lerPublico, alvosDe, MAX_ALVOS } = require('../../../../lib/dadosPessoais');

// Só RH. Muda para quem a atualização liberada vale, sem precisar encerrar e começar de novo:
//  - incluir: acrescenta mais colaboradores à lista (só quando foi liberada para alguns);
//  - todos: passa a valer para todos os colaboradores ativos.
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const corpo = await req.json();
    const campanha = await prisma.campanhaDados.findFirst({ where: { ativa: true }, orderBy: { criadaEm: 'desc' } });
    if (!campanha) return Response.json({ erro: 'Não há atualização liberada.' }, { status: 409 });
    const paraAlguns = campanha.publico === 'selecionados';

    if (corpo.acao === 'todos') {
      if (!paraAlguns) return Response.json({ erro: 'Esta atualização já vale para todos.' }, { status: 409 });
      await prisma.campanhaDados.updateMany({ where: { id: campanha.id, ativa: true }, data: { publico: 'todos', alvos: null } });
      return Response.json({ ok: true });
    }

    if (corpo.acao === 'incluir') {
      if (!paraAlguns) return Response.json({ erro: 'Esta atualização já vale para todos. Não é preciso incluir ninguém.' }, { status: 409 });
      const { erros, ids } = lerPublico({ publico: 'selecionados', colaboradorIds: corpo.colaboradorIds });
      if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });
      const validos = await prisma.colaborador.findMany({ where: { id: { in: ids }, ativo: true }, select: { id: true } });
      const atuais = alvosDe(campanha);
      const novos = validos.map((c) => c.id).filter((id) => !atuais.includes(id));
      if (novos.length === 0) return Response.json({ erro: 'Esses colaboradores já estão incluídos (ou não estão ativos).' }, { status: 409 });
      const lista = [...atuais, ...novos];
      if (lista.length > MAX_ALVOS) return Response.json({ erro: `A lista passaria de ${MAX_ALVOS} colaboradores. Use "Enviar para todos".` }, { status: 400 });
      await prisma.campanhaDados.updateMany({ where: { id: campanha.id, ativa: true }, data: { alvos: lista } });
      return Response.json({ ok: true, incluidos: novos.length });
    }

    return Response.json({ erro: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro ao mudar o público da atualização de dados:', err);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { POST };
