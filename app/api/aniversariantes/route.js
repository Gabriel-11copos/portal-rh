const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const { hojeBrasilia, aniversariantesDoMes } = require('../../../lib/aniversarios');

// Só RH: aniversariantes ativos de um mês (padrão: o mês atual).
async function GET(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const hoje = hojeBrasilia();
    let mes = parseInt(new URL(req.url).searchParams.get('mes'), 10);
    if (!(mes >= 1 && mes <= 12)) mes = Number(hoje.slice(5, 7));

    const lista = await prisma.colaborador.findMany({
      where: { ativo: true, dataNascimento: { not: null } },
      select: { id: true, nome: true, nomeSocial: true, loja: true, cargo: true, dataNascimento: true },
    });
    return Response.json({ mes, hoje, aniversariantes: aniversariantesDoMes(lista, mes) });
  } catch (err) {
    console.error('Erro ao listar aniversariantes:', err);
    return Response.json({ erro: 'Não foi possível carregar os aniversariantes.' }, { status: 500 });
  }
}

module.exports = { GET };
