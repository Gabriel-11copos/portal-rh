const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');

// O colaborador vê se há uma atualização de dados liberada pelo RH e se ainda falta ele fazer.
// Também devolve os dados da última vez, para a tela já vir preenchida.
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    // se as tabelas ainda não existirem, simplesmente não há atualização liberada
    let campanha;
    try {
      campanha = await prisma.campanhaDados.findFirst({ where: { ativa: true }, orderBy: { criadaEm: 'desc' } });
    } catch (err) {
      console.error('Não foi possível ler a atualização de dados:', err);
      return Response.json({ campanha: null, pendente: false, concluido: false });
    }
    if (!campanha) return Response.json({ campanha: null, pendente: false, concluido: false });

    const registro = await prisma.atualizacaoDados.findFirst({ where: { campanhaId: campanha.id, colaboradorId: sessao.id } });
    const ultima = await prisma.atualizacaoDados.findFirst({ where: { colaboradorId: sessao.id, origem: 'colaborador' }, orderBy: { criadoEm: 'desc' } });
    const cadastro = await prisma.colaborador.findUnique({ where: { id: sessao.id }, select: { email: true } });
    const u = ultima || {};
    return Response.json({
      campanha: { id: campanha.id, titulo: campanha.titulo, mensagem: campanha.mensagem, prazo: campanha.prazo },
      pendente: !registro,
      concluido: !!registro,
      origem: registro ? registro.origem : null,
      temComprovante: !!(registro && registro.comprovanteUrl),
      prefill: {
        telefone: u.telefone || '', email: u.email || (cadastro && cadastro.email) || '',
        cep: u.cep || '', logradouro: u.logradouro || '', numero: u.numero || '', complemento: u.complemento || '',
        bairro: u.bairro || '', cidade: u.cidade || '', uf: u.uf || '',
      },
    });
  } catch (err) {
    console.error('Erro ao consultar a atualização de dados:', err);
    return Response.json({ erro: 'Não foi possível consultar agora.' }, { status: 500 });
  }
}

module.exports = { GET };
