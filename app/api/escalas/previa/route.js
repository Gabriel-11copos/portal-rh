const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { normalizaCpf, montarSemana } = require('../../../../lib/escalas');

// Só RH. Mostra como a escala de um colaborador aparece para ele, sem precisar entrar com o
// login dele. Funciona mesmo com a escala ainda fechada para os colaboradores.
async function GET(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('colaboradorId');
    if (!id) return Response.json({ erro: 'Escolha um colaborador.' }, { status: 400 });

    const colaborador = await prisma.colaborador.findUnique({
      where: { id },
      select: { nome: true, nomeSocial: true, matricula: true, loja: true },
    });
    if (!colaborador) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

    const semana = await montarSemana({
      cpf: normalizaCpf(colaborador.matricula),
      inicio: url.searchParams.get('inicio'),
      dias: url.searchParams.get('dias'),
    });
    return Response.json({
      liberada: true,
      previa: true,
      colaborador: { nome: colaborador.nomeSocial || colaborador.nome, loja: colaborador.loja },
      ...semana,
    });
  } catch (err) {
    console.error('Erro na prévia da escala:', err);
    return Response.json({ erro: 'Não foi possível carregar a escala agora.' }, { status: 500 });
  }
}

module.exports = { GET };
