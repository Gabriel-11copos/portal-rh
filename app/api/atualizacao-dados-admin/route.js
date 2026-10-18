const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const { lerCampanha } = require('../../../lib/dadosPessoais');

// Só RH. Acompanha a atualização de dados: quem já fez, quem falta e o histórico das anteriores.
// Com ?resumo=1 devolve só os números (usado pela bolinha do menu).
async function GET(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const resumo = new URL(req.url).searchParams.get('resumo') === '1';

    // se as tabelas ainda não existirem, o painel abre vazio
    let ativa;
    try {
      ativa = await prisma.campanhaDados.findFirst({ where: { ativa: true }, orderBy: { criadaEm: 'desc' } });
    } catch (err) {
      console.error('Não foi possível ler a atualização de dados:', err);
      return Response.json({ ativa: null, historico: [], pendentes: [], concluidos: [], totais: null, semTabela: true });
    }

    const ativos = await prisma.colaborador.findMany({ where: { ativo: true }, select: { id: true, nome: true, loja: true, matricula: true } });
    const registros = ativa ? await prisma.atualizacaoDados.findMany({ where: { campanhaId: ativa.id } }) : [];
    const porColab = new Map(registros.map((r) => [r.colaboradorId, r]));
    const pendentes = ativos.filter((c) => !porColab.has(c.id));

    if (resumo) return Response.json({ ativa: !!ativa, titulo: ativa ? ativa.titulo : null, pendentes: ativa ? pendentes.length : 0 });

    const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    const concluidos = ativos.filter((c) => porColab.has(c.id)).map((c) => {
      const r = porColab.get(c.id);
      return {
        colaboradorId: c.id, nome: c.nome, loja: c.loja, cpf: c.matricula, origem: r.origem, quando: r.criadoEm,
        baixaPor: r.baixaPor || null, baixaMotivo: r.baixaMotivo || null,
        telefone: r.telefone || null, email: r.email || null, comprovanteUrl: r.comprovanteUrl || null,
        endereco: r.origem === 'colaborador' ? { cep: r.cep, logradouro: r.logradouro, numero: r.numero, complemento: r.complemento, bairro: r.bairro, cidade: r.cidade, uf: r.uf } : null,
      };
    }).sort(porNome);

    const anteriores = await prisma.campanhaDados.findMany({ where: { ativa: false }, orderBy: { criadaEm: 'desc' }, take: 10 });
    let contagens = [];
    if (anteriores.length > 0) {
      contagens = await prisma.atualizacaoDados.groupBy({ by: ['campanhaId', 'origem'], _count: { _all: true }, where: { campanhaId: { in: anteriores.map((c) => c.id) } } });
    }
    const historico = anteriores.map((c) => ({
      id: c.id, titulo: c.titulo, criadaEm: c.criadaEm, encerradaEm: c.encerradaEm,
      atualizaram: contagens.filter((x) => x.campanhaId === c.id && x.origem === 'colaborador').reduce((n, x) => n + x._count._all, 0),
      baixas: contagens.filter((x) => x.campanhaId === c.id && x.origem === 'baixa_rh').reduce((n, x) => n + x._count._all, 0),
    }));

    return Response.json({
      ativa: ativa ? { id: ativa.id, titulo: ativa.titulo, mensagem: ativa.mensagem, prazo: ativa.prazo, criadaEm: ativa.criadaEm, criadaPor: ativa.criadaPor } : null,
      totais: ativa ? {
        ativos: ativos.length,
        atualizaram: concluidos.filter((c) => c.origem === 'colaborador').length,
        baixas: concluidos.filter((c) => c.origem === 'baixa_rh').length,
        pendentes: pendentes.length,
      } : null,
      pendentes: ativa ? pendentes.map((c) => ({ id: c.id, nome: c.nome, loja: c.loja })).sort(porNome) : [],
      concluidos: ativa ? concluidos : [],
      historico,
    });
  } catch (err) {
    console.error('Erro ao carregar a atualização de dados do RH:', err);
    return Response.json({ erro: 'Não foi possível carregar.' }, { status: 500 });
  }
}

// Libera uma nova atualização para todos os colaboradores. Só pode haver uma liberada por vez.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { erros, campanha } = lerCampanha(await req.json());
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    const jaAtiva = await prisma.campanhaDados.findFirst({ where: { ativa: true } });
    if (jaAtiva) return Response.json({ erro: 'Já existe uma atualização liberada. Encerre a atual antes de liberar outra.' }, { status: 409 });

    let criada;
    try {
      criada = await prisma.campanhaDados.create({ data: { ...campanha, criadaPor: typeof sessao.nome === 'string' ? sessao.nome : null } });
    } catch (err) {
      // dois usuários do RH liberaram ao mesmo tempo: o banco só aceita uma liberada por vez
      if (err && err.code === 'P2002') return Response.json({ erro: 'Já existe uma atualização liberada. Encerre a atual antes de liberar outra.' }, { status: 409 });
      throw err;
    }
    return Response.json({ ok: true, id: criada.id });
  } catch (err) {
    console.error('Erro ao liberar a atualização de dados:', err);
    return Response.json({ erro: 'Não foi possível liberar agora.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
