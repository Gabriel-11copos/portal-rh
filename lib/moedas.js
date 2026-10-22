// Moeda do Brew (o nome é editável pelo RH; padrão "Tampinhas").
// O colaborador ganha moedas ao fazer atividades do portal e troca por saldo no Zig ou por prêmios.
// O saldo de cada pessoa é a SOMA do livro-caixa (MoedaLancamento): ganho +, troca -, estorno +, ajuste +/-.
// O programa nasce desligado e com todas as regras em zero: nada é pago até o RH validar os valores.

const { tabelaNaoExiste } = require('./acesso');

const PADRAO = { ativo: false, nomeSingular: 'Tampinha', nomePlural: 'Tampinhas', simbolo: '🪙' };

// Atividades do portal que podem render moedas (o RH define quanto cada uma vale; 0 = não paga).
// As missões também rendem: a chave delas é "missao:<id>".
const REGRAS_FIXAS = [
  { chave: 'atualizou_dados', rotulo: 'Atualizar os dados pessoais', descricao: 'Quando conclui a atualização de dados liberada pelo RH (uma vez por campanha).' },
  { chave: 'avaliou_atendimento', rotulo: 'Avaliar um atendimento do RH', descricao: 'Quando dá a nota de um pedido atendido (uma vez por pedido).' },
  { chave: 'leu_comunicado', rotulo: 'Ler um comunicado', descricao: 'Quando confirma a leitura de um comunicado (uma vez por comunicado).' },
];
const PREFIXO_MISSAO = 'missao:';

const TIPOS_PREMIO = { zig: 'Saldo no Zig', premio: 'Prêmio' };
const STATUS_RESGATE = { pendente: 'Aguardando o RH', entregue: 'Entregue', recusado: 'Recusado (moedas devolvidas)' };

const MAX_REGRA = 100000;
const MAX_CUSTO = 1000000;
const MAX_AJUSTE = 1000000;
const MAX_ESTOQUE = 100000;
const MAX_CENTAVOS = 100000000;   // R$ 1.000.000,00

// ---------- validação (cada função devolve o valor limpo ou null)
function inteiro(v, min, max) {
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) v = Number(v.trim());
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function texto(v, min, max) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return t.length >= min && t.length <= max ? t : null;
}

function moedasInstaladas(prisma) {
  return !!(prisma && prisma.moedaConfig && prisma.moedaRegra && prisma.moedaLancamento && prisma.moedaPremio && prisma.moedaResgate);
}

// ---------- configuração
async function lerConfig(prisma) {
  if (!moedasInstaladas(prisma)) return { ...PADRAO, instalada: false };
  try {
    const c = await prisma.moedaConfig.findUnique({ where: { id: 'unico' } });
    return { ativo: !!(c && c.ativo), nomeSingular: (c && c.nomeSingular) || PADRAO.nomeSingular, nomePlural: (c && c.nomePlural) || PADRAO.nomePlural, simbolo: (c && c.simbolo) || PADRAO.simbolo, instalada: true };
  } catch (err) {
    if (tabelaNaoExiste(err)) return { ...PADRAO, instalada: false };
    throw err;
  }
}

function validarConfig(c) {
  const nomeSingular = texto(c && c.nomeSingular, 2, 20);
  const nomePlural = texto(c && c.nomePlural, 2, 20);
  const simbolo = texto(c && c.simbolo, 1, 8);
  const erros = [];
  if (!nomeSingular) erros.push('O nome da moeda (singular) precisa ter de 2 a 20 letras.');
  if (!nomePlural) erros.push('O nome da moeda (plural) precisa ter de 2 a 20 letras.');
  if (!simbolo) erros.push('Escolha um símbolo (por exemplo, um emoji).');
  if (typeof (c && c.ativo) !== 'boolean') erros.push('Informe se o programa está ligado ou desligado.');
  return { erros, dados: { ativo: c && c.ativo === true, nomeSingular, nomePlural, simbolo } };
}

// ---------- saldo e extrato
async function saldoDe(db, colaboradorId) {
  const r = await db.moedaLancamento.aggregate({ where: { colaboradorId }, _sum: { valor: true } });
  return (r && r._sum && r._sum.valor) || 0;
}

const rotuloDoTipo = { ganho: 'Ganho', resgate: 'Troca', estorno: 'Devolução', ajuste: 'Ajuste' };
function visaoDoLancamento(l) {
  return { id: l.id, valor: l.valor, tipo: l.tipo, tipoRotulo: rotuloDoTipo[l.tipo] || l.tipo, descricao: l.descricao, criadoEm: l.criadoEm };
}

// ---------- ganhar moedas por uma atividade
// Nunca derruba quem chamou (o colaborador não pode ver erro por causa das moedas). Só paga se o programa
// estiver ligado e a atividade valer algo; a mesma atividade (mesma origem + referência) nunca paga duas vezes.
async function creditar(prisma, { colaboradorId, origem, referencia = null, descricao }) {
  try {
    if (!moedasInstaladas(prisma)) return { creditou: false, motivo: 'nao-instalado' };
    const cfg = await lerConfig(prisma);
    if (!cfg.ativo) return { creditou: false, motivo: 'desligado' };
    const regra = await prisma.moedaRegra.findUnique({ where: { chave: origem } });
    const valor = regra ? Number(regra.valor) : 0;
    if (!(valor > 0)) return { creditou: false, motivo: 'sem-valor' };
    await prisma.moedaLancamento.create({
      data: { colaboradorId, valor, tipo: 'ganho', origem, referencia: referencia == null ? null : String(referencia), descricao },
    });
    return { creditou: true, valor };
  } catch (err) {
    if (err && err.code === 'P2002') return { creditou: false, motivo: 'ja-creditado' };
    if (!tabelaNaoExiste(err)) console.error('Moedas: não foi possível creditar', err && err.code);
    return { creditou: false, motivo: 'erro' };
  }
}

// ---------- operações que mexem no saldo: uma pessoa por vez (evita gastar a mesma moeda duas vezes)
class Recusa extends Error {
  constructor(status, erro) { super(erro); this.status = status; this.erro = erro; }
}

async function comTrava(prisma, colaboradorId, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Colaborador" WHERE id = ${colaboradorId} FOR UPDATE`;
    return fn(tx);
  });
}

async function executar(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Recusa) return { ok: false, status: err.status, erro: err.erro };
    if (!tabelaNaoExiste(err)) console.error('Moedas: erro na operação', err && err.code);
    return { ok: false, status: 500, erro: 'Não foi possível concluir agora. Tente de novo em instantes.' };
  }
}

// O colaborador troca moedas por um prêmio: as moedas saem na hora e o pedido vai para o RH entregar.
async function resgatar(prisma, { colaboradorId, premioId }) {
  return executar(() => comTrava(prisma, colaboradorId, async (tx) => {
    const cfg = await lerConfig(tx);
    if (!cfg.ativo) throw new Recusa(409, 'O programa de moedas ainda não está ativo.');
    const premio = typeof premioId === 'string' ? await tx.moedaPremio.findUnique({ where: { id: premioId } }) : null;
    if (!premio || !premio.ativo) throw new Recusa(404, 'Este prêmio não está disponível.');
    if (premio.estoque !== null && premio.estoque !== undefined && premio.estoque <= 0) throw new Recusa(409, 'Este prêmio acabou.');
    const saldo = await saldoDe(tx, colaboradorId);
    if (saldo < premio.custo) throw new Recusa(409, `Saldo insuficiente: você tem ${saldo} e este prêmio custa ${premio.custo}.`);

    // a baixa do estoque é UMA operação condicional no banco ("só baixa se ainda houver"): duas pessoas diferentes
    // disputando a última unidade nunca levam as duas (a trava acima é por pessoa, não por prêmio)
    if (premio.estoque !== null && premio.estoque !== undefined) {
      const baixou = await tx.moedaPremio.updateMany({ where: { id: premio.id, estoque: { gt: 0 } }, data: { estoque: { decrement: 1 } } });
      if (baixou.count === 0) throw new Recusa(409, 'Este prêmio acabou.');
    }
    const resgate = await tx.moedaResgate.create({
      data: { colaboradorId, premioId: premio.id, premioNome: premio.nome, custo: premio.custo, tipo: premio.tipo, valorCentavos: premio.valorCentavos ?? null },
    });
    await tx.moedaLancamento.create({
      data: { colaboradorId, valor: -premio.custo, tipo: 'resgate', origem: `resgate:${resgate.id}`, referencia: null, descricao: `Troca: ${premio.nome}` },
    });
    return { ok: true, resgateId: resgate.id, saldo: saldo - premio.custo };
  }));
}

// O RH marca a troca como entregue, ou recusa (e as moedas voltam para a pessoa).
async function decidirResgate(prisma, { resgateId, acao, motivo, usuarioNome }) {
  return executar(async () => {
    const resgate = typeof resgateId === 'string' ? await prisma.moedaResgate.findUnique({ where: { id: resgateId } }) : null;
    if (!resgate) throw new Recusa(404, 'Troca não encontrada.');
    const agora = new Date();
    const nome = typeof usuarioNome === 'string' ? usuarioNome : null;

    if (acao === 'entregar') {
      const r = await prisma.moedaResgate.updateMany({ where: { id: resgate.id, status: 'pendente' }, data: { status: 'entregue', decididoPor: nome, decididoEm: agora } });
      if (r.count === 0) throw new Recusa(409, 'Esta troca já foi decidida.');
      return { ok: true };
    }
    if (acao !== 'recusar') throw new Recusa(400, 'Ação inválida.');
    const texto200 = motivo == null || motivo === '' ? '' : texto(motivo, 1, 200);
    if (texto200 === null) throw new Recusa(400, 'O motivo pode ter no máximo 200 letras.');

    return comTrava(prisma, resgate.colaboradorId, async (tx) => {
      const r = await tx.moedaResgate.updateMany({ where: { id: resgate.id, status: 'pendente' }, data: { status: 'recusado', motivoRecusa: texto200 || null, decididoPor: nome, decididoEm: agora } });
      if (r.count === 0) throw new Recusa(409, 'Esta troca já foi decidida.');
      await tx.moedaLancamento.create({
        data: { colaboradorId: resgate.colaboradorId, valor: resgate.custo, tipo: 'estorno', origem: `estorno:${resgate.id}`, referencia: null, descricao: `Moedas devolvidas: ${resgate.premioNome}`, criadoPor: nome },
      });
      const premio = await tx.moedaPremio.findUnique({ where: { id: resgate.premioId } });
      if (premio && premio.estoque !== null && premio.estoque !== undefined) await tx.moedaPremio.update({ where: { id: premio.id }, data: { estoque: { increment: 1 } } });
      return { ok: true };
    });
  });
}

// O RH dá ou tira moedas de uma pessoa, sempre com um motivo (o saldo não pode ficar negativo).
async function ajustar(prisma, { colaboradorId, valor, motivo, usuarioNome }) {
  const v = inteiro(valor, -MAX_AJUSTE, MAX_AJUSTE);
  const m = texto(motivo, 3, 200);
  if (v === null || v === 0) return { ok: false, status: 400, erro: 'Informe quantas moedas dar (número positivo) ou tirar (número negativo).' };
  if (m === null) return { ok: false, status: 400, erro: 'Explique o motivo (de 3 a 200 letras).' };
  return executar(() => comTrava(prisma, colaboradorId, async (tx) => {
    const colaborador = typeof colaboradorId === 'string' ? await tx.colaborador.findUnique({ where: { id: colaboradorId }, select: { id: true } }) : null;
    if (!colaborador) throw new Recusa(404, 'Colaborador não encontrado.');
    const saldo = await saldoDe(tx, colaboradorId);
    if (saldo + v < 0) throw new Recusa(409, `O saldo não pode ficar negativo (saldo atual: ${saldo}).`);
    await tx.moedaLancamento.create({
      data: { colaboradorId, valor: v, tipo: 'ajuste', origem: 'ajuste', referencia: null, descricao: `Ajuste do RH: ${m}`, criadoPor: typeof usuarioNome === 'string' ? usuarioNome : null },
    });
    return { ok: true, saldo: saldo + v };
  }));
}

// ---------- prêmios
function validarPremio(p, { parcial = false } = {}) {
  const erros = [];
  const dados = {};
  const tem = (k) => p && Object.prototype.hasOwnProperty.call(p, k);
  if (!parcial || tem('nome')) { dados.nome = texto(p && p.nome, 2, 80); if (!dados.nome) erros.push('O nome do prêmio precisa ter de 2 a 80 letras.'); }
  if (!parcial || tem('descricao')) {
    const d = p && (p.descricao == null || p.descricao === '') ? '' : texto(p && p.descricao, 1, 300);
    if (d === null) erros.push('A descrição pode ter no máximo 300 letras.'); else dados.descricao = d || null;
  }
  if (!parcial || tem('custo')) { dados.custo = inteiro(p && p.custo, 1, MAX_CUSTO); if (dados.custo === null) erros.push(`O custo precisa ser um número de moedas entre 1 e ${MAX_CUSTO}.`); }
  if (!parcial || tem('tipo')) { dados.tipo = p && TIPOS_PREMIO[p.tipo] ? p.tipo : null; if (!dados.tipo) erros.push('Escolha o tipo: saldo no Zig ou prêmio.'); }
  if (!parcial || tem('valorCentavos') || tem('tipo')) {
    const tipo = dados.tipo || (p && p.tipo);
    if (tipo === 'zig') { dados.valorCentavos = inteiro(p && p.valorCentavos, 1, MAX_CENTAVOS); if (dados.valorCentavos === null) erros.push('Informe quanto de saldo no Zig este prêmio dá (em reais).'); }
    else dados.valorCentavos = null;
  }
  if (!parcial || tem('estoque')) {
    if (!p || p.estoque == null || p.estoque === '') dados.estoque = null;
    else { dados.estoque = inteiro(p.estoque, 0, MAX_ESTOQUE); if (dados.estoque === null) erros.push(`O estoque precisa ser um número entre 0 e ${MAX_ESTOQUE} (ou deixe vazio para não limitar).`); }
  }
  if (!parcial || tem('ativo')) { if (typeof (p && p.ativo) !== 'boolean') erros.push('Informe se o prêmio está ativo.'); else dados.ativo = p.ativo; }
  return { erros, dados };
}

function visaoDoPremio(p) {
  const esgotado = p.estoque !== null && p.estoque !== undefined && p.estoque <= 0;
  return { id: p.id, nome: p.nome, descricao: p.descricao || null, custo: p.custo, tipo: p.tipo, tipoRotulo: TIPOS_PREMIO[p.tipo] || p.tipo, valorCentavos: p.valorCentavos ?? null, estoque: p.estoque ?? null, ativo: !!p.ativo, esgotado };
}

function visaoDoResgate(r) {
  return { id: r.id, premioNome: r.premioNome, custo: r.custo, tipo: r.tipo, tipoRotulo: TIPOS_PREMIO[r.tipo] || r.tipo, valorCentavos: r.valorCentavos ?? null, status: r.status, statusRotulo: STATUS_RESGATE[r.status] || r.status, motivoRecusa: r.motivoRecusa || null, criadoEm: r.criadoEm, decididoEm: r.decididoEm || null };
}

module.exports = {
  PADRAO, REGRAS_FIXAS, PREFIXO_MISSAO, TIPOS_PREMIO, STATUS_RESGATE, MAX_REGRA, MAX_CUSTO, MAX_AJUSTE, MAX_ESTOQUE,
  inteiro, texto, moedasInstaladas, lerConfig, validarConfig, saldoDe, visaoDoLancamento, creditar, comTrava, resgatar, decidirResgate, ajustar,
  validarPremio, visaoDoPremio, visaoDoResgate, Recusa,
};
