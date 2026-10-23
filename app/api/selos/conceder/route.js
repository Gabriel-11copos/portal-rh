const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { hojeBrasilia, extrairCpfs, validarPeriodoRef, planejarConcessao } = require('../../../../lib/selos');
const { notificarLote } = require('../../../../lib/whatsapp');

// Só RH. Dá um selo a uma ou várias pessoas, escolhidas por nome (colaboradorIds) e/ou por uma lista
// de CPFs (texto colado ou lido de planilha). Com { simular: true } só mostra a prévia, sem gravar.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { seloId, texto, colaboradorIds, periodoRef, mensagem, data, simular } = await req.json();

    const selo = await prisma.selo.findUnique({ where: { id: String(seloId || '') } });
    if (!selo || !selo.ativo) return Response.json({ erro: 'Escolha um selo ativo.' }, { status: 400 });

    const ref = periodoRef ? String(periodoRef) : null;
    if (ref && !validarPeriodoRef(ref)) return Response.json({ erro: 'Mês de referência inválido.' }, { status: 400 });
    if (selo.grupo === 'presenca' && !ref) {
      return Response.json({ erro: 'Selos de presença precisam do mês de referência.' }, { status: 400 });
    }

    const dia = data ? String(data) : hojeBrasilia();
    const dataConquista = /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T00:00:00.000Z`) : null;
    if (!dataConquista || isNaN(dataConquista)) return Response.json({ erro: 'Data inválida.' }, { status: 400 });

    const nota = String(mensagem || '').trim();
    if (nota.length > 200) return Response.json({ erro: 'A mensagem pode ter no máximo 200 letras.' }, { status: 400 });

    const cpfs = extrairCpfs(String(texto || '').slice(0, 300000));
    const ids = Array.isArray(colaboradorIds) ? colaboradorIds.filter((x) => typeof x === 'string').slice(0, 2000) : [];
    if (cpfs.length + ids.length === 0) return Response.json({ erro: 'Escolha pelo menos uma pessoa.' }, { status: 400 });
    if (cpfs.length > 2000) return Response.json({ erro: 'A lista tem CPFs demais. Envie até 2000 por vez.' }, { status: 400 });

    const colaboradores = await prisma.colaborador.findMany({
      select: { id: true, nome: true, nomeSocial: true, matricula: true, ativo: true, loja: true },
    });
    const jaConcedidos = ref ? await prisma.seloConcedido.findMany({ where: { seloId: selo.id, periodoRef: ref } }) : [];

    const plano = planejarConcessao({ colaboradores, cpfs, ids, periodoRef: ref, jaConcedidos });
    const nome = (c) => ({ id: c.id, nome: c.nomeSocial || c.nome, loja: c.loja });
    const relatorio = {
      selo: { nome: selo.nome, icone: selo.icone },
      novos: plano.novos.map(nome),
      jaTem: plano.jaTem.map(nome),
      inativos: plano.inativos.map(nome),
      naoEncontrados: plano.naoEncontrados,
      cpfsInvalidos: plano.cpfsInvalidos,
    };

    if (simular) return Response.json({ ok: true, simulacao: true, ...relatorio });

    let criados = 0;
    if (plano.novos.length > 0) {
      const r = await prisma.seloConcedido.createMany({
        data: plano.novos.map((c) => ({
          colaboradorId: c.id,
          seloId: selo.id,
          data: dataConquista,
          periodoRef: ref,
          mensagem: nota || null,
          concedidoPor: typeof sessao.nome === 'string' ? sessao.nome : null,
          vistoColaborador: false,
        })),
        skipDuplicates: true,
      });
      criados = r.count;
      // WhatsApp: avisa quem ganhou o selo (a chave evita avisar de novo)
      await notificarLote(prisma, plano.novos.map((c) => ({ evento: 'selo.recebido', chave: `selo:${c.id}:${selo.id}:${ref || dia}`, colaboradorId: c.id, dados: { selo: selo.nome } })));
    }
    return Response.json({ ok: true, simulacao: false, criados, ...relatorio });
  } catch (err) {
    console.error('Erro ao conceder selos:', err);
    return Response.json({ erro: 'Não foi possível conceder os selos.' }, { status: 500 });
  }
}

module.exports = { POST };
