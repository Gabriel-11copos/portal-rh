const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');

// Guarda a ordem das caixinhas do painel, separada para cada usuário do RH.
// Ações: "ler", "salvar" (com a lista de ids) e "restaurar" (volta à ordem padrão).
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { acao, ordem } = await req.json();
    const owner = `rh:${sessao.id}`;

    if (acao === 'ler') {
      // O nome vem da sessão do login (para a saudação). A ordem salva pode falhar (ex: tabela ainda
      // não criada) sem derrubar a saudação nem a tela.
      let ordemSalva = null;
      try {
        const p = await prisma.preferenciaPainel.findUnique({ where: { owner } });
        if (p && Array.isArray(p.ordemCards)) ordemSalva = p.ordemCards;
      } catch (err) {
        console.error('Não foi possível ler a ordem das caixinhas:', err);
      }
      return Response.json({ ordem: ordemSalva, nome: typeof sessao.nome === 'string' ? sessao.nome : null });
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
    console.error('Erro nas preferências do painel:', err);
    return Response.json({ erro: 'Não foi possível acessar as preferências.' }, { status: 500 });
  }
}

module.exports = { POST };
