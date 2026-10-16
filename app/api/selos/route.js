const { prisma } = require('../../../lib/db');
const { getSessaoRH } = require('../../../lib/auth');
const { SELOS_TEMPO, SELO_ANIVERSARIO, slugDoNome, lerCamposDoSelo } = require('../../../lib/selos');

// Só RH. Lista os selos que o RH gerencia e mostra os automáticos (só leitura).
async function GET() {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const selos = await prisma.selo.findMany({ orderBy: [{ grupo: 'asc' }, { nome: 'asc' }] });
    return Response.json({ selos, automaticos: { tempo: SELOS_TEMPO, aniversario: SELO_ANIVERSARIO } });
  } catch (err) {
    console.error('Erro ao listar selos:', err);
    return Response.json({ erro: 'Não foi possível carregar os selos.' }, { status: 500 });
  }
}

async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { saida, erros } = lerCamposDoSelo(await req.json(), false);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    // código único gerado a partir do nome
    const base = slugDoNome(saida.nome);
    let codigo = base;
    for (let i = 2; await prisma.selo.findUnique({ where: { codigo } }); i++) codigo = `${base}-${i}`;

    const criado = await prisma.selo.create({ data: { ...saida, codigo, ativo: true } });
    return Response.json(criado);
  } catch (err) {
    console.error('Erro ao criar selo:', err);
    return Response.json({ erro: 'Não foi possível criar o selo.' }, { status: 500 });
  }
}

module.exports = { GET, POST };
