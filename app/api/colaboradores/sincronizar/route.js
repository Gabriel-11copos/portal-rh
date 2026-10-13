const { prisma } = require('../../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../../lib/auth');
const { planejarSincronizacao } = require('../../../../lib/sincronizacao');

async function emLotes(itens, tamanho, fn) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

// Recebe a lista de ativos já lida da planilha (no navegador) e sincroniza:
// - CPF novo               -> cria o colaborador (admissão)
// - mudou de empresa/loja  -> atualiza a loja (transferência), sem recriar a pessoa
// - mudou de função        -> atualiza o cargo
// - estava inativo e voltou -> reativa
// - estava ativo e não está na lista -> inativa
// Toda mudança de situação, loja ou cargo fica registrada no histórico da pessoa.
//
// Com { simular: true } só calcula e devolve o que aconteceria, sem gravar nada.
async function POST(req) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { colaboradores, simular, forcar } = await req.json();
    if (!Array.isArray(colaboradores) || colaboradores.length === 0) {
      return Response.json({ erro: 'Lista de colaboradores vazia ou inválida.' }, { status: 400 });
    }

    const existentes = await prisma.colaborador.findMany({
      select: {
        id: true, nome: true, matricula: true, email: true, loja: true,
        cargo: true, ativo: true, dataAdmissao: true, dataNascimento: true,
      },
    });

    const plano = planejarSincronizacao(colaboradores, existentes);
    const base = {
      ...plano.relatorio,
      alerta: plano.alerta,
      motivoAlerta: plano.motivoAlerta,
      ativosAntes: plano.ativosAntes,
      totalNaLista: plano.totalNaLista,
    };

    if (simular) return Response.json({ ok: true, simulacao: true, ...base });

    if (plano.alerta && !forcar) {
      return Response.json({ erro: plano.motivoAlerta, ...base }, { status: 409 });
    }

    const historicos = [...plano.historicos];

    // Admissões (senha inicial = 6 primeiros dígitos do CPF, como no cadastro manual)
    await emLotes(plano.criar, 5, async (l) => {
      const senhaHash = await gerarHash(l.cpf.slice(0, 6));
      const novo = await prisma.colaborador.create({
        data: {
          nome: l.nome,
          matricula: l.cpf,
          email: l.email || `${l.cpf}@sememail.onzecopos.com.br`,
          loja: l.loja,
          cargo: l.cargo || null,
          dataAdmissao: l.dataAdmissao ? new Date(l.dataAdmissao) : null,
          dataNascimento: l.dataNascimento ? new Date(l.dataNascimento) : null,
          senhaHash,
          ativo: true,
        },
      });
      historicos.push({ colaboradorId: novo.id, tipo: 'admissao', de: null, para: l.loja });
    });

    // Transferências, mudanças de cargo, reativações e ajustes de cadastro
    await emLotes(plano.atualizar, 20, (u) =>
      prisma.colaborador.update({ where: { id: u.id }, data: u.data })
    );

    // Saídas
    if (plano.inativar.length > 0) {
      await prisma.colaborador.updateMany({
        where: { id: { in: plano.inativar.map((c) => c.id) } },
        data: { ativo: false },
      });
    }

    if (historicos.length > 0) {
      await prisma.historicoColaborador.createMany({
        data: historicos.map((h) => ({ ...h, origem: 'importacao' })),
      });
    }

    return Response.json({ ok: true, simulacao: false, ...base });
  } catch (err) {
    console.error('Erro ao sincronizar colaboradores:', err);
    return Response.json({ erro: `Erro ao sincronizar: ${err.message || 'erro desconhecido'}` }, { status: 500 });
  }
}

module.exports = { POST };
