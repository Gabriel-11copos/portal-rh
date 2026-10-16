const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const { hojeBrasilia, ehAniversario, garantirComunicado, primeiroNome, ARTE } = require('../../../lib/aniversarios');

// Diz se hoje é aniversário de quem está logado. Se for, garante que o comunicado existe
// (caso o agendador não tenha rodado) e devolve a arte para o cartão da tela inicial.
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ aniversario: false });

    const c = await prisma.colaborador.findUnique({
      where: { id: sessao.id },
      select: { id: true, nome: true, nomeSocial: true, loja: true, dataNascimento: true, ativo: true },
    });
    if (!c || !c.ativo) return Response.json({ aniversario: false });

    const hoje = hojeBrasilia();
    if (!ehAniversario(c.dataNascimento, hoje)) return Response.json({ aniversario: false });

    await garantirComunicado(prisma, c, hoje).catch((err) => console.error('Aniversário:', err));
    return Response.json({ aniversario: true, nome: primeiroNome(c), cartao: ARTE });
  } catch (err) {
    console.error('Erro ao verificar aniversário:', err);
    return Response.json({ aniversario: false });
  }
}

module.exports = { GET };
