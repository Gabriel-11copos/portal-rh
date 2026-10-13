const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');
const { kitDoGestor, integracaoAtiva } = require('../../../../lib/integracao');

// Devolve o kit de uniforme/EPI do cargo do colaborador logado (as regras ficam no Portal do Gestor).
// Só o próprio colaborador vê o dele: o CPF vem da sessão, nunca de um parâmetro.
async function GET() {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  const vazio = { disponivel: false, encontrada: false, itens: [], aviso: 'Não consegui carregar o uniforme do seu cargo agora. Descreva abaixo o que você precisa.' };
  if (!integracaoAtiva()) return Response.json(vazio);
  const colab = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
  if (!colab) return Response.json(vazio);
  const k = await kitDoGestor(colab.matricula);
  if (!k.ok) return Response.json(vazio);
  return Response.json({ disponivel: true, ...k.dados });
}

module.exports = { GET };
