const { prisma } = require('../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../lib/auth');

// Lista conteúdos: colaborador só vê os ativos; RH vê todos (inclusive inativos).
async function GET() {
  const sessaoRH = getSessaoRH();
  const sessaoColaborador = getSessaoColaborador();
  if (!sessaoRH && !sessaoColaborador) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const conteudos = await prisma.conteudo.findMany({
    where: sessaoRH ? {} : { ativo: true },
    orderBy: [{ categoria: 'asc' }, { criadoEm: 'desc' }],
  });
  return Response.json(conteudos);
}

// RH cria um novo conteúdo (curso, link, contato, benefício, regra, manual...).
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { categoria, titulo, descricao, tipo, url, nomeArquivo } = await req.json();
  const conteudo = await prisma.conteudo.create({
    data: { categoria, titulo, descricao, tipo, url, nomeArquivo },
  });
  return Response.json(conteudo);
}

module.exports = { GET, POST };
