const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');

// Guarda a ordem das caixinhas da tela inicial, separada para cada colaborador.
// Usa a mesma tabela do painel do RH (PreferenciaPainel), com o dono "col:<id>".
// Ações: "ler", "salvar" (com a lista de ids) e "restaurar" (volta à ordem padrão).
async function POST(req) {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { acao, ordem } = await req.json();
    const owner = `col:${sessao.id}`;

    if (acao === 'ler') {
      let ordemSalva = null;
      try {
        const p = await prisma.preferenciaPainel.findUnique({ where: { owner } });
        if (p && Array.isArray(p.ordemCards)) ordemSalva = p.ordemCards;
      } catch (err) {
        console.error('Não foi possível ler a ordem das caixinhas:', err);
      }
      return Response.json({ ordem: ordemSalva });
    }

    if (acao === 'salvar') {
      // só aceita uma lista de textos curtos (evita lixo no banco)
      const ok = Array.isArray(ordem) && ordem.length <= 60 && ordem.every((x) => typeof x === 'string' && x.length <= 40);
      if (!ok) return Response.json({ erro: 'Ordem inválida.' }, { status: 400 });
      await prisma.preferenciaPainel.upsert({
        where: { owner },
        update: { ordemCards: ordem },
        create: { owner, ordemCards: ordem },
      });
      return Response.json({ ok: true });
    }

    if (acao === 'restaurar') {
      await prisma.preferenciaPainel.deleteMany({ where: { owner } });
      return Response.json({ ok: true });
    }

    return Response.json({ erro: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro nas preferências do colaborador:', err);
    return Response.json({ erro: 'Não foi possível acessar as preferências.' }, { status: 500 });
  }
}

module.exports = { POST };
