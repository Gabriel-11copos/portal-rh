const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const { hojeBrasilia } = require('../../../../../lib/missoes');
const { creditar } = require('../../../../../lib/moedas');

// Só RH: decide um pedido de missão.
//  - aprovar: dá o selo da missão (se houver) e, se houver recompensa em texto, deixa "a entregar";
//  - recusar: com um motivo opcional que o colaborador vê;
//  - entregar: marca que a recompensa em texto (ex: voucher) já foi entregue.
async function POST(req, { params }) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { acao, motivo } = await req.json();
    const pedido = await prisma.missaoPedido.findUnique({ where: { id: params.id } });
    if (!pedido) return Response.json({ erro: 'Pedido não encontrado.' }, { status: 404 });
    const nomeRH = typeof sessao.nome === 'string' ? sessao.nome : null;
    const agora = new Date();

    if (acao === 'entregar') {
      const r = await prisma.missaoPedido.updateMany({
        where: { id: pedido.id, status: 'aprovada', recompensaPendente: true },
        data: { recompensaPendente: false, recompensaEntregueEm: agora },
      });
      if (r.count === 0) return Response.json({ erro: 'Não há recompensa pendente neste pedido.' }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (acao !== 'aprovar' && acao !== 'recusar') return Response.json({ erro: 'Ação inválida.' }, { status: 400 });

    const missao = await prisma.missao.findUnique({ where: { id: pedido.missaoId } });
    if (!missao) return Response.json({ erro: 'A missão deste pedido não existe mais.' }, { status: 404 });

    if (acao === 'recusar') {
      const texto = String(motivo || '').trim();
      if (texto.length > 200) return Response.json({ erro: 'O motivo pode ter no máximo 200 letras.' }, { status: 400 });
      const r = await prisma.missaoPedido.updateMany({
        where: { id: pedido.id, status: 'pendente' },
        data: { status: 'recusada', motivoRecusa: texto || null, decididoPor: nomeRH, decididoEm: agora, vistoColaborador: false },
      });
      if (r.count === 0) return Response.json({ erro: 'Este pedido já foi decidido.' }, { status: 409 });
      return Response.json({ ok: true });
    }

    // aprovar: primeiro "reserva" o pedido (só um clique vence), depois dá o selo
    const reservou = await prisma.missaoPedido.updateMany({
      where: { id: pedido.id, status: 'pendente' },
      data: {
        status: 'aprovada', decididoPor: nomeRH, decididoEm: agora, vistoColaborador: false,
        recompensaPendente: !!String(missao.recompensaTexto || '').trim(),
      },
    });
    if (reservou.count === 0) return Response.json({ erro: 'Este pedido já foi decidido.' }, { status: 409 });

    if (missao.seloId) {
      try {
        await prisma.seloConcedido.create({
          data: {
            colaboradorId: pedido.colaboradorId, seloId: missao.seloId,
            data: new Date(`${hojeBrasilia()}T00:00:00.000Z`), periodoRef: null,
            mensagem: `Missão: ${missao.titulo}`, concedidoPor: nomeRH, vistoColaborador: false,
          },
        });
      } catch (err) {
        // não conseguiu dar o selo: devolve o pedido para a fila, para tentar de novo
        console.error('Erro ao conceder o selo da missão:', err);
        await prisma.missaoPedido.updateMany({
          where: { id: pedido.id },
          data: { status: 'pendente', decididoPor: null, decididoEm: null, recompensaPendente: false, vistoColaborador: true },
        });
        return Response.json({ erro: 'Não foi possível conceder o selo. O pedido continua na fila, tente de novo.' }, { status: 500 });
      }
    }
    // moedas: missão aprovada rende (cada pedido aprovado paga uma vez; só vale com o programa ligado e um valor definido)
    await creditar(prisma, { colaboradorId: pedido.colaboradorId, origem: `missao:${missao.id}`, referencia: pedido.id, descricao: `Missão: ${missao.titulo}` });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao decidir pedido de missão:', err);
    return Response.json({ erro: 'Não foi possível concluir agora.' }, { status: 500 });
  }
}

module.exports = { POST };
