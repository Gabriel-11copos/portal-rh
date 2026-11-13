const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const { gerarCodigo, limparCodigo, codigoUnico } = require('../../../lib/codigoAssunto');

// Lista assuntos: colaborador vê só os ativos (formulário de nova solicitação);
// GGC vê todos, inclusive inativos, para poder reativar se precisar.
async function GET() {
  const sessao = getSessaoRH();
  const assuntos = await prisma.assunto.findMany({
    where: sessao ? {} : { ativo: true },
    orderBy: { nome: 'asc' },
  });
  // preenche o código de quem ainda não tem (assuntos criados antes dessa funcionalidade)
  if (sessao) {
    for (const a of assuntos) {
      if (!a.codigo) {
        try {
          const codigo = await codigoUnico(prisma, gerarCodigo(a.nome), a.id);
          await prisma.assunto.update({ where: { id: a.id }, data: { codigo } });
          a.codigo = codigo;
        } catch { /* se falhar, segue sem código; a tela mostra "(sem código)" */ }
      }
    }
  }
  return Response.json(assuntos);
}

// GGC cria um novo assunto/categoria.
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica, destino, fluxo, codigo } = await req.json();

  // código de integração: usa o que o GGC digitou, senão gera do nome; garante que é único
  const codigoBase = limparCodigo(codigo) || gerarCodigo(nome);
  const codigoFinal = await codigoUnico(prisma, codigoBase);

  const assunto = await prisma.assunto.create({
    data: { nome, codigo: codigoFinal, prazoPadraoDias, responsavelPadrao, respostaAutomatica, destino: destino === 'gestor' ? 'gestor' : 'rh', fluxo: ['atestado', 'uniforme'].includes(fluxo) ? fluxo : 'padrao' },
  });

  return Response.json(assunto);
}

module.exports = { GET, POST };
