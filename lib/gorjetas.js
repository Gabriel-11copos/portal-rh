// Compara a planilha de gorjeta com o que já está publicado e monta o plano.
// Função "pura": não acessa o banco, só decide o que fazer. O cruzamento com o
// colaborador é SOMENTE pelo CPF (a loja do cadastro é por empresa e a gorjeta
// é por unidade, então transferidos seguem sempre o CPF que aparece na planilha).
// Todos os valores em dinheiro são números inteiros em CENTAVOS.

const TOLERANCIA_LINHA = 2;   // centavos de diferença aceitos nas contas de cada linha
const TOLERANCIA_TOTAL = 100; // R$ 1,00 de diferença aceita na soma contra a linha "Total"

const CAMPOS_VALOR = [
  'apuracao', 'valorAtrasos', 'valorFaltas', 'redistribuicao',
  'brutaFinal', 'devolucao', 'valorFinal', 'retencao', 'liquida',
];
const CAMPOS_COMPARAR = [...CAMPOS_VALOR, 'atrasosQtd', 'faltasQtd', 'cargo', 'periodoFim', 'situacao'];

function limparCpf(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

function inteiro(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
}

// As contas de cada linha precisam fechar, senão a linha não é publicada.
function linhaFecha(l) {
  return (
    Math.abs(l.apuracao + l.valorAtrasos + l.valorFaltas + l.redistribuicao - l.brutaFinal) <= TOLERANCIA_LINHA &&
    Math.abs(l.brutaFinal + l.devolucao - l.valorFinal) <= TOLERANCIA_LINHA &&
    Math.abs(l.valorFinal - l.retencao - l.liquida) <= TOLERANCIA_LINHA
  );
}

function igual(a, b) {
  return (a == null ? null : a) === (b == null ? null : b);
}

function planejarGorjetas({ linhas: brutas, colaboradores, existentes, totaisPlanilha, periodoFim, situacao }) {
  const porCpf = new Map(colaboradores.map((c) => [c.matricula, c]));
  const nomePorId = new Map(colaboradores.map((c) => [c.id, c.nome]));
  const existentePorColab = new Map(existentes.map((e) => [e.colaboradorId, e]));

  const ignoradas = [];
  const vistos = new Set();
  const validas = [];

  for (const b of brutas) {
    const cpf = limparCpf(b.cpf);
    const nome = String(b.nome || '').trim();
    if (cpf.length !== 11) {
      ignoradas.push(`${nome || '(sem nome)'} — CPF inválido`);
      continue;
    }
    if (vistos.has(cpf)) {
      ignoradas.push(`${nome || cpf} — CPF repetido na planilha`);
      continue;
    }
    const linha = {
      cpf,
      nome,
      cargo: b.cargo ? String(b.cargo).trim() : null,
      atrasosQtd: inteiro(b.atrasosQtd),
      faltasQtd: inteiro(b.faltasQtd),
    };
    let legivel = linha.atrasosQtd !== null && linha.faltasQtd !== null;
    for (const c of CAMPOS_VALOR) {
      linha[c] = inteiro(b[c]);
      if (linha[c] === null) legivel = false;
    }
    if (!legivel) {
      ignoradas.push(`${nome || cpf} — valor ilegível na planilha`);
      continue;
    }
    vistos.add(cpf);
    validas.push(linha);
  }

  // Soma das linhas x linha "Total" da própria planilha
  let conferencia = null;
  if (totaisPlanilha) {
    const diferencas = [];
    for (const c of CAMPOS_VALOR) {
      if (totaisPlanilha[c] == null) continue;
      const soma = validas.reduce((s, l) => s + l[c], 0);
      if (Math.abs(soma - totaisPlanilha[c]) > TOLERANCIA_TOTAL) {
        diferencas.push({ campo: c, planilha: totaisPlanilha[c], soma });
      }
    }
    conferencia = { ok: diferencas.length === 0, diferencas };
  }

  const criar = [];
  const atualizar = [];
  const manter = [];
  const naoEncontrados = [];
  const inconsistentes = [];
  const inativos = [];
  const publicados = new Set();
  let somaLiquida = 0;

  for (const l of validas) {
    const c = porCpf.get(l.cpf);
    if (!c) {
      naoEncontrados.push({ nome: l.nome, cpf: l.cpf, cargo: l.cargo, liquida: l.liquida });
      continue;
    }
    if (!linhaFecha(l)) {
      inconsistentes.push(l.nome || c.nome);
      continue;
    }
    if (!c.ativo) inativos.push(c.nome);
    publicados.add(c.id);
    somaLiquida += l.liquida;

    const dados = {
      cargo: l.cargo,
      atrasosQtd: l.atrasosQtd,
      faltasQtd: l.faltasQtd,
      apuracao: l.apuracao,
      valorAtrasos: l.valorAtrasos,
      valorFaltas: l.valorFaltas,
      redistribuicao: l.redistribuicao,
      brutaFinal: l.brutaFinal,
      devolucao: l.devolucao,
      valorFinal: l.valorFinal,
      retencao: l.retencao,
      liquida: l.liquida,
      periodoFim,
      situacao,
    };

    const ex = existentePorColab.get(c.id);
    if (!ex) {
      criar.push({ colaboradorId: c.id, ...dados, vistoColaborador: false });
      continue;
    }
    const mudou = CAMPOS_COMPARAR.some((k) => {
      const a = k === 'periodoFim' ? new Date(ex[k]).getTime() : ex[k];
      const b = k === 'periodoFim' ? new Date(dados[k]).getTime() : dados[k];
      return !igual(a, b);
    });
    if (mudou) atualizar.push({ id: ex.id, data: { ...dados, vistoColaborador: false } });
    else manter.push(ex.id);
  }

  // Quem já estava publicado neste período e não está mais na planilha sai
  const remover = existentes
    .filter((e) => !publicados.has(e.colaboradorId))
    .map((e) => ({ id: e.id, colaboradorId: e.colaboradorId }));

  const motivosAlerta = [];
  if (conferencia && !conferencia.ok) {
    motivosAlerta.push('A soma das linhas não bate com a linha "Total" da planilha. Confira se o arquivo está completo e não foi alterado.');
  }
  if (validas.length > 0 && naoEncontrados.length > validas.length * 0.3) {
    motivosAlerta.push(`${naoEncontrados.length} de ${validas.length} CPFs da planilha não estão cadastrados no sistema. Confira se é a planilha certa.`);
  }
  if (existentes.length > 0 && remover.length > existentes.length * 0.3) {
    motivosAlerta.push(`Esta publicação removeria ${remover.length} de ${existentes.length} extratos já publicados deste período.`);
  }

  return {
    criar,
    atualizar,
    remover,
    relatorio: {
      totalNaPlanilha: validas.length,
      novos: criar.length,
      atualizados: atualizar.length,
      semMudanca: manter.length,
      removidos: remover.map((r) => nomePorId.get(r.colaboradorId) || r.colaboradorId),
      naoEncontrados,
      inconsistentes,
      ignoradas,
      inativos,
      conferencia,
      somaLiquida,
      alerta: motivosAlerta.length > 0,
      motivosAlerta,
    },
  };
}

module.exports = { planejarGorjetas, linhaFecha, TOLERANCIA_LINHA, TOLERANCIA_TOTAL };
