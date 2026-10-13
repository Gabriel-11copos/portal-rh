// Compara a lista de ativos (vinda da planilha) com os colaboradores cadastrados
// e monta o plano de mudanças. É uma função "pura": não acessa o banco, só decide
// o que precisa ser feito. Quem grava no banco é a rota de sincronização.

const SUFIXO_SEM_EMAIL = '@sememail.onzecopos.com.br';

function normalizar(txt) {
  return String(txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function limparCpf(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

function planejarSincronizacao(linhasBrutas, existentes) {
  const ignoradas = [];
  const nomesIgnorados = new Set();
  const vistos = new Set();
  const linhas = [];

  for (const l of linhasBrutas) {
    const cpf = limparCpf(l.cpf);
    const nome = String(l.nome || '').trim();
    if (cpf.length !== 11) {
      ignoradas.push(`${nome || '(sem nome)'} — CPF inválido`);
      if (nome) nomesIgnorados.add(normalizar(nome));
      continue;
    }
    if (vistos.has(cpf)) {
      ignoradas.push(`${nome || cpf} — CPF repetido na planilha`);
      continue;
    }
    vistos.add(cpf);
    linhas.push({ ...l, cpf, nome, loja: String(l.loja || '').trim() });
  }

  const porCpf = new Map(existentes.map((c) => [c.matricula, c]));
  const lojasExistentes = new Set(existentes.map((c) => c.loja));
  const ativosAntes = existentes.filter((c) => c.ativo).length;

  const criar = [];
  const atualizar = [];
  const inativar = [];
  const historicos = [];
  const rel = {
    admitidos: [],
    reativados: [],
    transferidos: [],
    mudancasCargo: [],
    atualizados: [],
    inativados: [],
    ignoradas,
    verificar: [],
    lojasNovas: [],
  };

  function marcarLojaNova(loja) {
    if (loja && !lojasExistentes.has(loja) && !rel.lojasNovas.includes(loja)) rel.lojasNovas.push(loja);
  }

  for (const l of linhas) {
    const ex = porCpf.get(l.cpf);

    // CPF que ainda não existe no sistema = admissão
    if (!ex) {
      if (!l.nome || !l.loja) {
        ignoradas.push(`${l.nome || l.cpf} — sem nome ou empresa, não foi admitido`);
        continue;
      }
      criar.push(l);
      rel.admitidos.push(l.nome);
      marcarLojaNova(l.loja);
      continue;
    }

    const dados = {};
    let teveHistorico = false;
    const nomeExibido = l.nome || ex.nome;

    // Estava inativo e voltou para a lista = reativação
    if (!ex.ativo) {
      dados.ativo = true;
      if (l.dataAdmissao) dados.dataAdmissao = new Date(l.dataAdmissao);
      historicos.push({ colaboradorId: ex.id, tipo: 'reativacao', de: null, para: l.loja || ex.loja });
      rel.reativados.push(nomeExibido);
      teveHistorico = true;
    }

    // Mudou de empresa/loja = transferência
    if (l.loja && l.loja !== ex.loja) {
      dados.loja = l.loja;
      historicos.push({ colaboradorId: ex.id, tipo: 'transferencia', de: ex.loja, para: l.loja });
      rel.transferidos.push({ nome: nomeExibido, de: ex.loja, para: l.loja });
      marcarLojaNova(l.loja);
      teveHistorico = true;
    }

    // Mudou de função = mudança de cargo (promoção, rebaixamento ou troca lateral)
    if (l.cargo && l.cargo !== (ex.cargo || '')) {
      dados.cargo = l.cargo;
      historicos.push({ colaboradorId: ex.id, tipo: 'mudanca_cargo', de: ex.cargo || null, para: l.cargo });
      rel.mudancasCargo.push({ nome: nomeExibido, de: ex.cargo || '—', para: l.cargo });
      teveHistorico = true;
    }

    // Dados cadastrais (não entram no histórico)
    let mudouCadastro = false;
    if (l.nome && l.nome !== ex.nome) { dados.nome = l.nome; mudouCadastro = true; }
    if (l.email && String(ex.email || '').endsWith(SUFIXO_SEM_EMAIL)) { dados.email = l.email; mudouCadastro = true; }
    if (l.dataAdmissao && !ex.dataAdmissao && !dados.dataAdmissao) { dados.dataAdmissao = new Date(l.dataAdmissao); mudouCadastro = true; }
    if (l.dataNascimento && !ex.dataNascimento) { dados.dataNascimento = new Date(l.dataNascimento); mudouCadastro = true; }

    if (Object.keys(dados).length > 0) {
      atualizar.push({ id: ex.id, data: dados });
      if (mudouCadastro && !teveHistorico) rel.atualizados.push(nomeExibido);
    }
  }

  // Estava ativo e não aparece mais na lista = saiu da empresa
  for (const c of existentes) {
    if (!c.ativo || vistos.has(c.matricula)) continue;
    // Se a planilha tem uma linha com o mesmo nome, mas CPF inválido, é mais provável
    // um erro de digitação do que um desligamento: não inativa, só avisa.
    if (nomesIgnorados.has(normalizar(c.nome))) {
      rel.verificar.push(c.nome);
      continue;
    }
    inativar.push({ id: c.id, nome: c.nome, loja: c.loja });
    historicos.push({ colaboradorId: c.id, tipo: 'inativacao', de: c.loja, para: null });
    rel.inativados.push(c.nome);
  }

  // Trava de segurança contra planilha errada ou parcial
  let alerta = false;
  let motivoAlerta = null;
  if (ativosAntes > 0) {
    if (inativar.length > ativosAntes * 0.2) {
      alerta = true;
      motivoAlerta = `Esta importação inativaria ${inativar.length} de ${ativosAntes} colaboradores ativos (mais de 20%). Confira se a planilha é a lista completa de ativos da empresa toda.`;
    } else if (linhas.length < ativosAntes * 0.5) {
      alerta = true;
      motivoAlerta = `A planilha tem ${linhas.length} pessoas e o sistema tem ${ativosAntes} ativas. Parece uma lista parcial.`;
    }
  }

  return {
    criar,
    atualizar,
    inativar,
    historicos,
    relatorio: rel,
    alerta,
    motivoAlerta,
    ativosAntes,
    totalNaLista: linhas.length,
  };
}

module.exports = { planejarSincronizacao, normalizar };
