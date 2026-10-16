// Leitura (somente leitura) das escalas do escalas-app.
// A chave da API fica só no servidor (variável ESCALAS_APP_API_KEY) e nunca vai para o navegador.

const URL_BASE = () => process.env.ESCALAS_APP_URL || 'https://escalas-api-qnoq.onrender.com';
const TEMPO_LIMITE_PADRAO_MS = 8000;

function normalizaCpf(v) {
  const digitos = String(v == null ? '' : v).replace(/\D/g, '');
  return digitos ? digitos.padStart(11, '0') : '';
}

// A chave vem de uma variável do Vercel. Espaço, quebra de linha ou aspas coladas junto com ela
// são um erro comum e fazem o serviço recusar a chave, então são removidos aqui.
function chaveDaApi() {
  return String(process.env.ESCALAS_APP_API_KEY || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

// Resumo seguro da chave em uso, para diagnóstico: nunca devolve a chave inteira,
// só o tamanho e os 4 últimos caracteres (como a máscara de um cartão).
function resumoDaChave() {
  const bruta = process.env.ESCALAS_APP_API_KEY;
  if (bruta === undefined || bruta === null || String(bruta).trim() === '') return { configurada: false };
  const texto = String(bruta);
  const usada = chaveDaApi();
  return {
    configurada: true,
    tamanhoSalvoNoVercel: texto.length,
    tamanhoEnviado: usada.length,
    tinhaEspacoQuebraOuAspasNasPontas: texto !== usada,
    comecaCom: usada.slice(0, 4),
    terminaCom: usada.slice(-4),
    ambienteVercel: process.env.VERCEL_ENV || null,
  };
}

// Consulta UM dia. Nunca lança erro: devolve sempre { ok, status, ms, corpo, erro, mensagem }.
async function consultarEscalas({ data, lojaCodigo, incluirAusencias, tempoLimiteMs }) {
  const chave = chaveDaApi();
  if (!chave) {
    return { ok: false, status: null, ms: 0, erro: 'sem_chave', mensagem: 'A chave da API de escalas não está configurada (variável ESCALAS_APP_API_KEY no Vercel).' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) {
    return { ok: false, status: null, ms: 0, erro: 'data_invalida', mensagem: 'Data inválida (use AAAA-MM-DD).' };
  }

  const params = new URLSearchParams({ data });
  if (lojaCodigo !== undefined && lojaCodigo !== null && String(lojaCodigo).trim() !== '') {
    params.set('lojaCodigo', String(lojaCodigo).trim());
  }
  if (incluirAusencias) params.set('incluirAusencias', 'true');

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), tempoLimiteMs || TEMPO_LIMITE_PADRAO_MS);
  const inicio = Date.now();
  try {
    const res = await fetch(`${URL_BASE()}/api/integracao/escalas?${params.toString()}`, {
      headers: { 'x-api-key': chave },
      signal: controlador.signal,
    });
    const texto = await res.text();
    let corpo = null;
    try { corpo = JSON.parse(texto); } catch { corpo = null; }
    return { ok: res.ok, status: res.status, ms: Date.now() - inicio, corpo, textoBruto: corpo === null ? texto.slice(0, 300) : null };
  } catch (err) {
    const estourou = err && err.name === 'AbortError';
    return {
      ok: false,
      status: null,
      ms: Date.now() - inicio,
      erro: estourou ? 'tempo_esgotado' : 'falha_de_rede',
      mensagem: estourou
        ? 'O serviço de escalas demorou demais para responder. Se ele estiver "dormindo", a primeira chamada costuma demorar: espere um minuto e tente de novo.'
        : 'Não foi possível conectar ao serviço de escalas.',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Mascaramento: o resultado do teste vai ser colado numa conversa, então CPF e nome não saem inteiros.

function mascararValor(chave, valor) {
  if (valor == null) return valor;
  const k = String(chave || '');
  const digitos = String(valor).replace(/\D/g, '');
  if (/cpf|matricula/i.test(k) || (typeof valor === 'string' && /^[\d.\-\s]+$/.test(valor) && digitos.length === 11)) {
    return `***${digitos.slice(-2)}`;
  }
  if (/^(nome|nomecompleto|nomecolaborador|nomefuncionario)$/i.test(k) && typeof valor === 'string') {
    return `${valor.split(' ')[0]}…`;
  }
  return valor;
}

function mascararObjeto(o, profundidade) {
  if (profundidade > 4) return '…';
  if (Array.isArray(o)) {
    return o.slice(0, 5).map((v) => (v && typeof v === 'object' ? mascararObjeto(v, profundidade + 1) : v));
  }
  const saida = {};
  for (const [k, v] of Object.entries(o)) {
    saida[k] = v && typeof v === 'object' ? mascararObjeto(v, profundidade + 1) : mascararValor(k, v);
  }
  return saida;
}

function tipoDe(v) {
  if (v === null) return 'nulo';
  if (Array.isArray(v)) return 'lista';
  return typeof v === 'object' ? 'objeto' : typeof v;
}

function acharLista(corpo) {
  if (Array.isArray(corpo)) return { caminho: '(a própria resposta é a lista)', lista: corpo };
  if (corpo && typeof corpo === 'object') {
    for (const [k, v] of Object.entries(corpo)) {
      if (Array.isArray(v)) return { caminho: k, lista: v };
    }
  }
  return { caminho: null, lista: null };
}

// Resume a resposta: onde está a lista, quantos itens, quais campos, e uma amostra mascarada.
function descreverResposta(corpo) {
  const { caminho, lista } = acharLista(corpo);
  const topo = corpo && typeof corpo === 'object' && !Array.isArray(corpo)
    ? Object.fromEntries(Object.entries(corpo).map(([k, v]) => [k, tipoDe(v)]))
    : null;
  const primeiro = lista && lista.length > 0 && lista[0] && typeof lista[0] === 'object' ? lista[0] : null;
  return {
    estruturaDoTopo: topo,
    listaEm: caminho,
    totalDeItens: lista ? lista.length : null,
    camposDoPrimeiroItem: primeiro ? Object.fromEntries(Object.entries(primeiro).map(([k, v]) => [k, tipoDe(v)])) : null,
    amostraMascarada: lista ? mascararObjeto(lista.slice(0, 3), 0) : mascararObjeto(corpo, 0),
  };
}


// =====================================================================
// Escala do colaborador (tela "Minha escala")
// =====================================================================

// Data de hoje no horário de Brasília, no formato AAAA-MM-DD (o servidor roda em UTC).
function hojeBrasilia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Soma dias a uma data AAAA-MM-DD sem depender de fuso horário.
function somarDias(dataISO, n) {
  const [a, m, d] = dataISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// Trava de liberação: a tela só aparece para quem estiver em ESCALA_TESTE_CPFS (CPFs separados
// por vírgula) ou para todos, quando ESCALA_LIBERADA for "sim". Sem nenhuma das duas, fica fechada.
function escalaLiberadaPara(cpf) {
  if (String(process.env.ESCALA_LIBERADA || '').trim().toLowerCase() === 'sim') return true;
  const teste = String(process.env.ESCALA_TESTE_CPFS || '').split(',').map(normalizaCpf).filter(Boolean);
  return !!cpf && teste.includes(cpf);
}

// Escala de TODOS os colaboradores da rede em um dia (sem informar loja, para pegar também quem
// trabalha numa unidade diferente da do cadastro). A resposta é a mesma para todo mundo, então
// fica guardada por alguns minutos e chamadas simultâneas aproveitam a mesma busca.
const VALIDADE_CACHE_MS = 5 * 60 * 1000;
const cacheDias = new Map(); // data -> { quando, promessa }

function buscarDiaCompleto(data) {
  const guardado = cacheDias.get(data);
  if (guardado && Date.now() - guardado.quando < VALIDADE_CACHE_MS) return guardado.promessa;

  const promessa = (async () => {
    const r = await consultarEscalas({ data, incluirAusencias: true });
    if (!r.ok || !r.corpo) {
      return { ok: false, mensagem: r.mensagem || 'O serviço de escalas não respondeu.' };
    }
    if (!Array.isArray(r.corpo.escalas)) {
      return { ok: false, mensagem: 'O serviço de escalas respondeu em um formato inesperado.' };
    }
    return { ok: true, lista: r.corpo.escalas };
  })();

  cacheDias.set(data, { quando: Date.now(), promessa });
  promessa.then((v) => { if (!v.ok) cacheDias.delete(data); });
  if (cacheDias.size > 120) cacheDias.delete(cacheDias.keys().next().value);
  return promessa;
}

const ORDEM_STATUS = { TRABALHO: 0, EMPRESTADO: 1 };

// Só as linhas do próprio colaborador (cruzamento pelo CPF), já no formato que a tela usa.
function montarDia(lista, cpf) {
  if (!cpf) return [];
  const vistos = new Set();
  const itens = [];
  for (const e of lista) {
    if (normalizaCpf(e.funcionarioDocumento) !== cpf) continue;
    const item = {
      status: String(e.status || ''),
      entrada: e.horarioEntradaPrevisto || null,
      saida: e.horarioSaidaPrevisto || null,
      lojaNome: e.lojaNome || null,
      cargo: e.cargo || null,
      area: e.area || null,
    };
    const chave = JSON.stringify(item);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push(item);
  }
  return itens.sort((a, b) => {
    const oa = ORDEM_STATUS[a.status] === undefined ? 2 : ORDEM_STATUS[a.status];
    const ob = ORDEM_STATUS[b.status] === undefined ? 2 : ORDEM_STATUS[b.status];
    return oa - ob || String(a.entrada || '').localeCompare(String(b.entrada || ''));
  });
}

// Monta os dias da semana de UMA pessoa (cruzando pelo CPF). Usada pela tela do colaborador
// e pela prévia do RH, para as duas mostrarem exatamente a mesma coisa.
async function montarSemana({ cpf, inicio, dias }) {
  const hoje = hojeBrasilia();
  let ini = inicio || hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ini)) ini = hoje;
  const minimo = somarDias(hoje, -28);
  const maximo = somarDias(hoje, 56);
  if (ini < minimo) ini = minimo;
  if (ini > maximo) ini = maximo;

  let n = parseInt(dias, 10);
  if (!Number.isFinite(n) || n < 1) n = 7;
  if (n > 7) n = 7;

  const datas = Array.from({ length: n }, (_, i) => somarDias(ini, i));
  const lista = await Promise.all(
    datas.map(async (data) => {
      const r = await buscarDiaCompleto(data);
      if (!r.ok) return { data, erro: r.mensagem, itens: [] };
      return { data, itens: montarDia(r.lista, cpf) };
    })
  );
  return { hoje, inicio: ini, minimo, maximo, dias: lista };
}

module.exports = {
  consultarEscalas,
  chaveDaApi,
  resumoDaChave,
  descreverResposta,
  mascararObjeto,
  normalizaCpf,
  hojeBrasilia,
  somarDias,
  escalaLiberadaPara,
  buscarDiaCompleto,
  montarDia,
  montarSemana,
};
