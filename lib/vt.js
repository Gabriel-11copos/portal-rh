// Vale-transporte: regras de valor, trajeto no Google Maps e termo de não optante.
// Módulo PURO (sem banco, sem Node): roda no servidor e no navegador, então o valor que a pessoa vê na tela
// é exatamente o que o servidor calcula e grava.

const TRANSPORTES = {
  jae: [
    { chave: 'onibus_municipal', rotulo: 'Ônibus municipal' }, { chave: 'van', rotulo: 'Van' }, { chave: 'brt', rotulo: 'BRT' },
    { chave: 'cabritinho', rotulo: 'Cabritinho' }, { chave: 'vlt', rotulo: 'VLT' },
  ],
  riocard: [
    { chave: 'onibus_municipal', rotulo: 'Ônibus municipal' }, { chave: 'onibus_intermunicipal', rotulo: 'Ônibus intermunicipal' },
    { chave: 'barca', rotulo: 'Barca' }, { chave: 'metro', rotulo: 'Metrô' }, { chave: 'trem', rotulo: 'Trem' },
  ],
  // quando o colaborador usa JAE + RIOCARD, o Riocard só vale para estes (e só UM deles)
  riocardCombinado: [{ chave: 'barca', rotulo: 'Barca' }, { chave: 'metro', rotulo: 'Metrô' }, { chave: 'trem', rotulo: 'Trem' }],
};
const MODALIDADES = { jae: 'JAE', riocard: 'RIOCARD', jae_riocard: 'JAE + RIOCARD', diferente: 'Meu caso é diferente', nao_usa: 'Não utilizo vale-transporte' };
const BUI = { sim: 'Sim, tenho o BUI ativo', nao: 'Não tenho', nao_sei: 'Não sei' };
// Os comprovantes de saldo ficam no mesmo armazenamento privado dos contracheques, com este prefixo no tipo.
// As listas de documentos (do colaborador e do RH) escondem esses tipos: o RH vê os comprovantes no perfil de vale-transporte.
const PREFIXO_DOC_SALDO = 'Saldo VT ';
const ehDocumentoDeSaldo = (tipo) => String(tipo == null ? '' : tipo).startsWith(PREFIXO_DOC_SALDO);
const VIAGENS_POR_DIA = 2;                                   // ida e volta
const REGRAS_PADRAO = { jae: 500, riocardUm: 500, riocardIntegracao: 940 };   // centavos POR VIAGEM (o RH edita no painel)

const ROTULOS = Object.fromEntries([...TRANSPORTES.jae, ...TRANSPORTES.riocard].map((t) => [t.chave, t.rotulo]));
const chavesDe = (lista) => new Set(lista.map((t) => t.chave));
const unicos = (lista) => [...new Set(Array.isArray(lista) ? lista.map(String) : [])];

const MSG = {
  modalidade_invalida: 'Escolha como você usa o vale-transporte.',
  sem_transporte: 'Marque pelo menos um transporte.',
  transporte_invalido: 'Há um transporte que não existe nesta opção.',
  jae_com_riocard: 'Na opção JAE só valem os transportes do JAE. Para usar também o Riocard, escolha JAE + RIOCARD.',
  municipal_so_jae: 'Ônibus municipal sozinho só funciona com o JAE. Escolha a opção JAE.',
  max_dois_riocard: 'O Riocard só permite 2 transportes. Se o seu caso é outro, use "Meu caso é diferente".',
  riocard_combinado_um: 'No JAE + RIOCARD, o Riocard vale para um só transporte (metrô, trem ou barca), porque o valor máximo é R$ 5,00.',
  riocard_combinado_invalido: 'No JAE + RIOCARD, o Riocard é só para metrô, trem ou barca. Os demais transportes entram no JAE.',
  caso_vazio: 'Conte o seu caso com um pouco mais de detalhe (pelo menos 10 letras).',
};
const erro = (codigo) => ({ ok: false, codigo, erro: MSG[codigo] });

// Calcula o valor POR VIAGEM e POR DIA a partir da escolha. "regras" vem do painel do RH (centavos).
function calcular({ modalidade, jae = [], riocard = [], casoDiferente = '' } = {}, regras = REGRAS_PADRAO) {
  const r = { ...REGRAS_PADRAO, ...(regras || {}) };
  const j = unicos(jae); const c = unicos(riocard);
  const validoJae = chavesDe(TRANSPORTES.jae); const validoRio = chavesDe(TRANSPORTES.riocard); const validoCombinado = chavesDe(TRANSPORTES.riocardCombinado);
  const pronto = (itens) => { const viagem = itens.reduce((n, i) => n + i.centavos, 0); return { ok: true, viagem, dia: viagem * VIAGENS_POR_DIA, detalhe: itens }; };

  if (modalidade === 'nao_usa') return { ok: true, viagem: 0, dia: 0, detalhe: [] };
  if (modalidade === 'diferente') {
    return String(casoDiferente || '').trim().length >= 10 ? { ok: true, viagem: null, dia: null, detalhe: [], semValor: true } : erro('caso_vazio');
  }
  if (modalidade === 'jae') {
    if (c.length > 0) return erro('jae_com_riocard');
    if (j.length === 0) return erro('sem_transporte');
    if (!j.every((x) => validoJae.has(x))) return erro('transporte_invalido');
    // a integração do JAE cobre 2 transportes (3 com BRT); o que passar disso não custa mais, então não bloqueamos
    return pronto([{ rotulo: 'JAE', centavos: r.jae }]);
  }
  if (modalidade === 'riocard') {
    if (j.length > 0) return erro('jae_com_riocard');
    if (c.length === 0) return erro('sem_transporte');
    if (!c.every((x) => validoRio.has(x))) return erro('transporte_invalido');
    if (c.length >= 3) return erro('max_dois_riocard');
    if (c.length === 2) return pronto([{ rotulo: 'RIOCARD (integração de 2 transportes)', centavos: r.riocardIntegracao }]);
    if (c[0] === 'onibus_municipal') return erro('municipal_so_jae');
    if (c[0] === 'onibus_intermunicipal') return pronto([{ rotulo: 'RIOCARD (ônibus intermunicipal)', centavos: r.riocardIntegracao }]);
    return pronto([{ rotulo: `RIOCARD (${ROTULOS[c[0]]}, tarifa do BUI)`, centavos: r.riocardUm }]);
  }
  if (modalidade === 'jae_riocard') {
    if (j.length === 0 || c.length === 0) return erro('sem_transporte');
    if (!j.every((x) => validoJae.has(x))) return erro('transporte_invalido');
    if (c.length > 1) return erro(c.every((x) => validoCombinado.has(x)) ? 'riocard_combinado_um' : 'riocard_combinado_invalido');
    if (!validoCombinado.has(c[0])) return validoRio.has(c[0]) ? erro('riocard_combinado_invalido') : erro('transporte_invalido');
    return pronto([{ rotulo: 'JAE', centavos: r.jae }, { rotulo: `RIOCARD (${ROTULOS[c[0]]})`, centavos: r.riocardUm }]);
  }
  return erro('modalidade_invalida');
}

// O que o RH precisa acompanhar. "bui" vale para quem usa Riocard; qualquer resposta diferente de "sim" vira alerta.
function alertasDe({ modalidade, buiAtivo }) {
  const alertas = [];
  if ((modalidade === 'riocard' || modalidade === 'jae_riocard') && buiAtivo !== 'sim') alertas.push('bui');
  if (modalidade === 'diferente') alertas.push('caso_diferente');
  return alertas;
}
const ROTULO_ALERTA = { bui: 'BUI a validar', caso_diferente: 'Caso diferente', sem_mapeamento: 'Sem mapeamento', saldo_pendente: 'Saldo pendente', saldo_refazer: 'Nova foto pedida' };

// ---------- valor do mês: o valor do dia vezes os dias DO MÊS (28 a 31). Folgas, faltas e atestados são tratados no painel do gestor.
const diasNoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
function valorMensal(diaCentavos, ano, mes) {
  if (diaCentavos === null || diaCentavos === undefined) return null;
  return diaCentavos * diasNoMes(ano, mes);
}

// ---------- formatos
const reais = (centavos) => (centavos === null || centavos === undefined ? '' : (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
function formatarCpf(v) { const d = soDigitos(v).padStart(11, '0').slice(-11); return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`; }
function formatarCnpj(v) { const d = soDigitos(v); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : String(v || ''); }
// "12,50" ou "12.50" ou "R$ 12,50" -> 1250 (centavos). Inválido: null.
function lerReais(texto) {
  const t = String(texto == null ? '' : texto).replace(/R\$/gi, '').replace(/\s/g, '');
  const m = t.match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/);
  return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0') || 0) : null;
}
const nomesDosTransportes = (chaves) => unicos(chaves).map((k) => ROTULOS[k] || k);

// ---------- trajeto no Google Maps (link gratuito, sem chave): abre o aplicativo já com a rota de transporte público
function enderecoEmTexto(e) {
  if (!e) return '';
  const rua = [e.logradouro || e.origemLogradouro, e.numero || e.origemNumero].filter(Boolean).join(', ');
  const partes = [rua, e.complemento || e.origemComplemento, e.bairro || e.origemBairro, [e.cidade || e.origemCidade, e.uf || e.origemUf].filter(Boolean).join(' - '), e.cep || e.origemCep].filter(Boolean);
  return partes.join(', ');
}
function linkTrajeto({ origem, destino, sentido = 'ida' }) {
  const de = sentido === 'volta' ? destino : origem; const para = sentido === 'volta' ? origem : destino;
  if (!de || !para) return null;
  const q = new URLSearchParams({ api: '1', origin: de, destination: para, travelmode: 'transit' });
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

// ---------- termo de não optante (texto fornecido pelo RH; só os campos entre os traços são preenchidos)
const TERMO_TITULO = 'TERMO DE NÃO OPTANTE PELO VALE-TRANSPORTE';
const TERMO_PARAGRAFOS = [
  'Eu, acima identificado(a), declaro, para os devidos fins, que não tenho interesse em receber o benefício do Vale-Transporte, disponibilizado pelo empregador, por não necessitar de sua utilização para o deslocamento entre minha residência e o local de trabalho, bem como no retorno.',
  'Declaro estar ciente de que o Vale-Transporte é um benefício destinado ao custeio do deslocamento por transporte coletivo público, nos termos da Lei nº 7.418/1985 e do Decreto nº 10.854/2021.',
  'Comprometo-me a comunicar imediatamente ao Departamento Pessoal caso ocorra qualquer alteração na minha necessidade de deslocamento que justifique a solicitação do benefício.',
  'Declaro, ainda, que as informações prestadas neste documento são verdadeiras e que esta opção poderá ser revista mediante solicitação formal ao empregador.',
  'Por ser expressão da minha livre vontade, firmo o presente termo.',
];
const dataPorExtenso = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });
// "05/11/2026 às 12:07" no horário de Brasília (montado à mão: o formato do toLocaleString muda entre versões do Node)
function dataHoraBR(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
}

// Devolve { titulo, cabecalho:[[rótulo, valor]], paragrafos, local, rodape, texto } (o PDF e a tela usam o mesmo conteúdo)
function montarTermo({ empregador, cnpj, nome, cpf, cargo, unidade, data, aceitoEm }) {
  const cabecalho = [['EMPREGADOR', empregador || ''], ['CNPJ', formatarCnpj(cnpj)], ['EMPREGADO(A)', nome || ''], ['CPF', formatarCpf(cpf)], ['CARGO', cargo || ''], ['UNIDADE', unidade || '']];
  const local = `Rio de Janeiro, ${dataPorExtenso(data || new Date())}.`;
  const rodape = aceitoEm ? `Aceite digital registrado em ${dataHoraBR(aceitoEm)}, no Portal do Colaborador, por meio de login individual.` : '';
  const texto = [TERMO_TITULO, '', ...cabecalho.map(([r, v]) => `${r}: ${v}`), '', ...TERMO_PARAGRAFOS.flatMap((p) => [p, '']), local, ...(rodape ? ['', rodape] : [])].join('\n');
  return { titulo: TERMO_TITULO, cabecalho, paragrafos: TERMO_PARAGRAFOS, local, rodape, texto };
}

module.exports = {
  TRANSPORTES, MODALIDADES, BUI, VIAGENS_POR_DIA, PREFIXO_DOC_SALDO, ehDocumentoDeSaldo, REGRAS_PADRAO, MSG, ROTULOS, ROTULO_ALERTA,
  calcular, alertasDe, diasNoMes, valorMensal, reais, lerReais, soDigitos, formatarCpf, formatarCnpj, nomesDosTransportes,
  enderecoEmTexto, linkTrajeto, TERMO_TITULO, TERMO_PARAGRAFOS, montarTermo, dataHoraBR,
};
