const { prisma } = require('../../../lib/db');
const { getSessaoColaborador, getSessaoRH } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');
const { somarDiasUteis } = require('../../../lib/feriados');
const { destinoFinal, avisarGestor, kitDoGestor } = require('../../../lib/integracao');
const { escopoSolicitacoes } = require('../../../lib/acesso');
const { modoDeAcesso } = require('../../../lib/contexto');
const { abrirSolicitacao } = require('../../../lib/pedidos');

// Cria uma nova solicitação e aplica a triagem automática com base no assunto:
// define prazo, responsável, e devolve resposta automática se o assunto tiver uma cadastrada.
async function POST(req) {
  const sessao = getSessaoColaborador();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { assuntoId, descricao, anexos, emailContato, whatsapp, dadosExtras } = await req.json();

  const assunto = await prisma.assunto.findUnique({ where: { id: assuntoId } });
  if (!assunto) return Response.json({ erro: 'Assunto inválido.' }, { status: 400 });

  // Pedido de atestado: precisa da data, dos dias e de pelo menos um arquivo.
  let extrasJson = null;
  if (assunto.fluxo === 'atestado') {
    const dataAtestado = String((dadosExtras && dadosExtras.dataAtestado) || '');
    const dias = Number(dadosExtras && dadosExtras.dias);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAtestado)) return Response.json({ erro: 'Informe a data do atestado.' }, { status: 400 });
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) return Response.json({ erro: 'Informe quantos dias (de 1 a 30).' }, { status: 400 });
    if (!anexos || !anexos.length) return Response.json({ erro: 'Anexe a foto ou o PDF do atestado.' }, { status: 400 });
    extrasJson = JSON.stringify({ dataAtestado, dias });
  }

  // Pedido de uniforme/EPI: só itens do cargo do colaborador (o kit vem do Portal do Gestor), com tamanho e quantidade.
  if (assunto.fluxo === 'uniforme') {
    const u = (dadosExtras && dadosExtras.uniforme) || {};
    const motivo = String(u.motivo || '');
    if (!['Kit inicial (admissão)', 'Reposição (vencimento)', 'Troca (dano ou perda)', 'Outro'].includes(motivo)) return Response.json({ erro: 'Escolha o motivo do pedido.' }, { status: 400 });
    const observacao = String(u.observacao || '').trim().slice(0, 500);
    if (motivo === 'Outro' && !observacao) return Response.json({ erro: 'Em "Outro", explique o motivo na observação.' }, { status: 400 });
    const pedidos = Array.isArray(u.itens) ? u.itens : [];
    const colabU = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
    const kit = await kitDoGestor(colabU.matricula);
    const kitItens = kit.ok && kit.dados && kit.dados.encontrada ? kit.dados.itens || [] : [];
    if (pedidos.length === 0) {
      if (kitItens.length > 0) return Response.json({ erro: 'Marque pelo menos um item do seu uniforme.' }, { status: 400 });
      if (!String(descricao || '').trim()) return Response.json({ erro: 'Descreva o que você precisa.' }, { status: 400 });
      extrasJson = JSON.stringify({ uniforme: { motivo, observacao, itens: [] } });
    } else {
      if (!kit.ok) return Response.json({ erro: 'Não consegui conferir o seu uniforme agora. Tente de novo em instantes.' }, { status: 503 });
      const limpos = [];
      for (const p of pedidos) {
        const ref = kitItens.find((k) => k.item === p.item);
        if (!ref) return Response.json({ erro: 'O item "' + String(p.item).slice(0, 60) + '" não faz parte do uniforme do seu cargo.' }, { status: 400 });
        if (limpos.some((l) => l.item === ref.item)) return Response.json({ erro: 'O item "' + ref.item + '" apareceu duas vezes.' }, { status: 400 });
        const qtd = Number(p.qtd);
        if (!Number.isInteger(qtd) || qtd < 1 || qtd > ref.qtd) return Response.json({ erro: 'Quantidade inválida em "' + ref.item + '" (de 1 a ' + ref.qtd + ').' }, { status: 400 });
        if (ref.tamanhos && !ref.tamanhos.includes(String(p.tamanho))) return Response.json({ erro: 'Escolha o tamanho de "' + ref.item + '".' }, { status: 400 });
        limpos.push({ item: ref.item, categoria: ref.categoria || 'uniforme', qtd, tamanho: ref.tamanhos ? String(p.tamanho) : null });
      }
      extrasJson = JSON.stringify({ uniforme: { motivo, observacao, itens: limpos } });
    }
  }

  // a triagem e a criação do pedido são as mesmas do WhatsApp (lib/pedidos.js)
  const colaborador = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
  if (!colaborador) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  const solicitacao = await abrirSolicitacao(prisma, { colaborador, assunto, descricao, anexos, emailContato, whatsapp, extrasJson });

  return Response.json({ ok: true, id: solicitacao.id });
}

// Lista solicitações: do colaborador logado, ou todas (para o RH, com filtros opcionais).
async function GET(req) {
  const url = new URL(req.url);
  const sessaoColaborador = getSessaoColaborador();
  const sessaoRH = getSessaoRH();
  // quem tem os dois logins no mesmo navegador: nas telas do painel vale o RH, nas do colaborador vale o colaborador
  const modo = modoDeAcesso(req, { rh: sessaoRH, colaborador: sessaoColaborador });

  if (modo === 'rh') {
    // quem vê tudo (master, ou com a permissão "Ver todas as solicitações") e quem vê só os assuntos que atende
    const escopo = await escopoSolicitacoes(prisma, sessaoRH);
    if (!escopo.todas && escopo.assuntoIds.length === 0) return Response.json([]);
    const status = url.searchParams.get('status');
    const where = {};
    if (status) where.status = status;
    if (!escopo.todas) where.assuntoId = { in: escopo.assuntoIds };
    const solicitacoes = await prisma.solicitacao.findMany({
      where,
      include: { colaborador: true, assunto: true, respostas: true, anexos: true },
      orderBy: { numero: 'desc' },
    });
    // a senha (criptografada) do colaborador nunca sai do servidor
    return Response.json(solicitacoes.map((s) => {
      if (!s.colaborador) return s;
      const { senhaHash, ...colaborador } = s.colaborador;
      return { ...s, colaborador };
    }));
  }

  if (modo === 'colaborador') {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { colaboradorId: sessaoColaborador.id },
      include: { assunto: true, respostas: true, anexos: true },
      orderBy: { numero: 'desc' },
    });
    return Response.json(solicitacoes);
  }

  return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
}

module.exports = { POST, GET };
