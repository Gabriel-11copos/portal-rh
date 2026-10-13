const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');

// Histórico de movimentações de um colaborador (admissão, transferência, etc.)
async function GET(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const historico = await prisma.historicoColaborador.findMany({
    where: { colaboradorId: params.id },
    orderBy: { data: 'desc' },
  });
  return Response.json(historico);
}

// RH altera situação, loja ou cargo manualmente (ex: desligamento imediato, sem esperar
// a próxima planilha). Cada mudança também entra no histórico.
async function PATCH(req, { params }) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = params;
  const { ativo, loja, cargo } = await req.json();

  const atual = await prisma.colaborador.findUnique({ where: { id } });
  if (!atual) return Response.json({ erro: 'Colaborador não encontrado.' }, { status: 404 });

  const dados = {};
  const historicos = [];

  if (ativo !== undefined && ativo !== atual.ativo) {
    dados.ativo = ativo;
    historicos.push({
      colaboradorId: id,
      tipo: ativo ? 'reativacao' : 'inativacao',
      de: ativo ? null : atual.loja,
      para: ativo ? atual.loja : null,
      origem: 'manual',
    });
  }
  if (loja !== undefined && loja !== atual.loja) {
    dados.loja = loja;
    historicos.push({ colaboradorId: id, tipo: 'transferencia', de: atual.loja, para: loja, origem: 'manual' });
  }
  if (cargo !== undefined && cargo !== atual.cargo) {
    dados.cargo = cargo;
    historicos.push({ colaboradorId: id, tipo: 'mudanca_cargo', de: atual.cargo, para: cargo, origem: 'manual' });
  }

  if (Object.keys(dados).length === 0) {
    const { senhaHash, driveFolderId, ...publico } = atual;
    return Response.json(publico);
  }

  const colaborador = await prisma.colaborador.update({ where: { id }, data: dados });
  if (historicos.length > 0) {
    await prisma.historicoColaborador.createMany({ data: historicos });
  }

  const { senhaHash, driveFolderId, ...publico } = colaborador;
  return Response.json(publico);
}

module.exports = { GET, PATCH };
