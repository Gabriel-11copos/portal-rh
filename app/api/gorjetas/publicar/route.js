const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { planejarGorjetas } = require('../../../../lib/gorjetas');

function dataUTC(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d) ? null : d;
}

async function emLotes(itens, tamanho, fn) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

// Recebe a planilha de gorjeta já lida no navegador e publica os extratos.
// - O colaborador é identificado SOMENTE pelo CPF.
// - O período é identificado por unidade + data de início (dia 26). Publicar de novo
//   o mesmo início substitui o anterior (serve para atualizar um período em aberto).
// Com { simular: true } só calcula e devolve a prévia, sem gravar nada.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { unidade, periodoInicio, periodoFim, situacao, linhas, totaisPlanilha, simular, forcar } = await req.json();

    const nomeUnidade = String(unidade || '').trim();
    const inicio = dataUTC(periodoInicio);
    const fim = dataUTC(periodoFim);
    if (!nomeUnidade) return Response.json({ erro: 'Informe a unidade (ex: Terraço Botafogo).' }, { status: 400 });
    if (!inicio || !fim || fim < inicio) return Response.json({ erro: 'Período inválido. Confira as datas de início e fim.' }, { status: 400 });
    if (!['parcial', 'fechado'].includes(situacao)) return Response.json({ erro: 'Situação inválida.' }, { status: 400 });
    if (!Array.isArray(linhas) || linhas.length === 0) return Response.json({ erro: 'A planilha não tem linhas.' }, { status: 400 });

    const colaboradores = await prisma.colaborador.findMany({
      select: { id: true, nome: true, matricula: true, ativo: true },
    });
    const existentes = await prisma.gorjeta.findMany({
      where: { unidade: nomeUnidade, periodoInicio: inicio },
    });

    const plano = planejarGorjetas({
      linhas,
      colaboradores,
      existentes,
      totaisPlanilha: totaisPlanilha || null,
      periodoFim: fim,
      situacao,
    });

    if (simular) return Response.json({ ok: true, simulacao: true, ...plano.relatorio });

    if (plano.relatorio.alerta && !forcar) {
      return Response.json({ erro: plano.relatorio.motivosAlerta.join(' '), ...plano.relatorio }, { status: 409 });
    }

    if (plano.criar.length > 0) {
      await prisma.gorjeta.createMany({
        data: plano.criar.map((c) => ({ ...c, unidade: nomeUnidade, periodoInicio: inicio })),
      });
    }
    await emLotes(plano.atualizar, 20, (u) => prisma.gorjeta.update({ where: { id: u.id }, data: u.data }));
    if (plano.remover.length > 0) {
      await prisma.gorjeta.deleteMany({ where: { id: { in: plano.remover.map((r) => r.id) } } });
    }

    return Response.json({ ok: true, simulacao: false, ...plano.relatorio });
  } catch (err) {
    console.error('Erro ao publicar gorjetas:', err);
    return Response.json({ erro: `Erro ao publicar: ${err.message || 'erro desconhecido'}` }, { status: 500 });
  }
}

module.exports = { POST };
