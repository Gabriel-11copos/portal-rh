const { prisma } = require('../../../lib/db');
const { getSessaoColaborador, getSessaoRH } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');
const { somarDiasUteis } = require('../../../lib/feriados');
const { destinoFinal, avisarGestor, kitDoGestor } = require('../../../lib/integracao');

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

  const prazo = somarDiasUteis(new Date(), assunto.prazoPadraoDias);

  // Pra onde vai o pedido: o assunto manda pro gestor da loja (o Administrativo vai pro RH).
  const colabDestino = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
  const destino = destinoFinal(assunto, colabDestino && colabDestino.loja);

  const solicitacao = await prisma.solicitacao.create({
    data: {
      colaboradorId: sessao.id,
      destino,
      dadosExtras: extrasJson,
      assuntoId,
      descricao,
      emailContato,
      whatsapp,
      prazo,
      status: assunto.respostaAutomatica ? 'respondida' : 'aberta',
      vistoColaborador: !assunto.respostaAutomatica,
      anexos: {
        create: (anexos || []).map((a) => ({
          linkDrive: a.link,
          nomeArquivo: a.nomeArquivo,
          enviadoPor: 'colaborador',
        })),
      },
    },
  });

  // Triagem automática: se o assunto já tem resposta padrão configurada, responde na hora.
  if (assunto.respostaAutomatica) {
    await prisma.resposta.create({
      data: {
        solicitacaoId: solicitacao.id,
        texto: assunto.respostaAutomatica,
        automatica: true,
      },
    });
  }

  const colaborador = await prisma.colaborador.findUnique({ where: { id: sessao.id } });
  await enviarEmail(
    colaborador.email,
    `Solicitação recebida: ${assunto.nome}`,
    `<p>Olá ${colaborador.nome}, recebemos sua solicitação sobre <b>${assunto.nome}</b>.</p>
     ${assunto.respostaAutomatica ? `<p>${assunto.respostaAutomatica}</p>` : '<p>Ela será analisada pela nossa equipe em breve.</p>'}`
  );

  await avisarGestor('solicitacao.criada', solicitacao.id);

  return Response.json({ ok: true, id: solicitacao.id });
}

// Lista solicitações: do colaborador logado, ou todas (para o RH, com filtros opcionais).
async function GET(req) {
  const url = new URL(req.url);
  const sessaoColaborador = getSessaoColaborador();
  const sessaoRH = getSessaoRH();

  if (sessaoRH) {
    const status = url.searchParams.get('status');
    const solicitacoes = await prisma.solicitacao.findMany({
      where: status ? { status } : {},
      include: { colaborador: true, assunto: true, respostas: true, anexos: true },
      orderBy: { numero: 'desc' },
    });
    return Response.json(solicitacoes);
  }

  if (sessaoColaborador) {
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
