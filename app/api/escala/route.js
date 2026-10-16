const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const { normalizaCpf, escalaLiberadaPara, montarSemana } = require('../../../lib/escalas');

// Devolve ao colaborador SOMENTE os próprios turnos (a lista de todos fica no servidor).
// Parâmetros: inicio (AAAA-MM-DD, padrão hoje) e dias (1 a 7, padrão 7).
async function GET(req) {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const colaborador = await prisma.colaborador.findUnique({
      where: { id: sessao.id },
      select: { matricula: true },
    });
    if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

    const cpf = normalizaCpf(colaborador.matricula);
    if (!escalaLiberadaPara(cpf)) return Response.json({ liberada: false });

    const url = new URL(req.url);
    const semana = await montarSemana({
      cpf,
      inicio: url.searchParams.get('inicio'),
      dias: url.searchParams.get('dias'),
    });
    return Response.json({ liberada: true, ...semana });
  } catch (err) {
    console.error('Erro ao montar a escala do colaborador:', err);
    return Response.json({ erro: 'Não foi possível carregar a escala agora.' }, { status: 500 });
  }
}

module.exports = { GET };
