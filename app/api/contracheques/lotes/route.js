const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { lerTipo, lerCompetencia, lerLoja } = require('../../../../lib/contracheques');

// Só RH. Abre o registro de um envio no histórico (qual loja, qual competência, quantos documentos).
// Cada documento publicado depois, com este código, vai somando no registro.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const corpo = await req.json();
    const tipo = lerTipo(corpo.tipo);
    const competencia = lerCompetencia(corpo.competencia);
    const loja = lerLoja(corpo.loja);
    const total = Number(corpo.total);
    if (!tipo) return Response.json({ erro: 'Tipo inválido.' }, { status: 400 });
    if (!competencia) return Response.json({ erro: 'Competência inválida.' }, { status: 400 });
    if (!loja) return Response.json({ erro: 'Escolha a loja.' }, { status: 400 });
    if (!Number.isInteger(total) || total < 1 || total > 2000) return Response.json({ erro: 'Quantidade inválida.' }, { status: 400 });

    const lote = await prisma.contrachequeLote.create({
      data: { tipo, competencia, loja, total, enviadoPor: typeof sessao.nome === 'string' ? sessao.nome : null },
    });
    return Response.json({ id: lote.id });
  } catch (err) {
    console.error('Erro ao registrar o envio no histórico:', err);
    return Response.json({ erro: 'Não foi possível registrar o envio no histórico.' }, { status: 500 });
  }
}

module.exports = { POST };
