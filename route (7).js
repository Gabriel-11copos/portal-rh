const { prisma } = require('../../../../../lib/db');
const { getSessaoColaborador } = require('../../../../../lib/auth');
const { adicionarMensagemDoColaborador } = require('../../../../../lib/pedidos');

async function POST(req, { params }) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { texto, anexos } = await req.json();
  const { id } = params;

  const r = await adicionarMensagemDoColaborador(prisma, { colaborador: { id: sessao.id, nome: sessao.nome }, solicitacaoId: id, texto, anexos });
  if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
  return Response.json({ ok: true, solicitacao: r.solicitacao });
}

module.exports = { POST };
