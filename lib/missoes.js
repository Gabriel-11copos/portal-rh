// Missões: tarefas com nome, descrição, prazo opcional e uma recompensa (um selo e/ou um texto, como "R$ 100 em voucher").
// Duas formas de cumprir:
//  - "selo": a missão se cumpre SOZINHA quando a pessoa ganha aquele selo (ex: presença de 3 meses);
//  - "aprovacao": a pessoa registra o pedido e o RH aprova ou recusa (ex: Indica Aí).
// Este arquivo só decide o que é válido e em que estado a missão está; quem grava no banco são as rotas.

const FUSO = 'America/Sao_Paulo';
const MODOS = ['selo', 'aprovacao'];
const MAX_PEDIDOS_PENDENTES = 3;   // em missões repetíveis, no máximo 3 pedidos esperando de cada vez

function hojeBrasilia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
}

function diaDoPrazo(prazo) {
  if (!prazo) return null;
  const d = new Date(prazo);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// A missão vale até o fim do dia do prazo.
function encerrada(missao, hojeISO) {
  const dia = diaDoPrazo(missao.prazo);
  return !!dia && hojeISO > dia;
}

function lerPrazo(valor, erros) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const s = String(valor).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null;
  if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== s) { erros.push('Prazo inválido.'); return null; }
  return d;
}

// Valida uma missão nova.
function lerMissao(corpo) {
  const erros = [];
  const titulo = String(corpo.titulo || '').trim();
  const descricao = String(corpo.descricao || '').trim();
  const modo = corpo.modo;
  const seloId = String(corpo.seloId || '').trim();
  const recompensaTexto = String(corpo.recompensaTexto || '').trim();
  const rotuloReferencia = modo === 'aprovacao' ? String(corpo.rotuloReferencia || '').trim() : '';

  if (titulo.length < 3 || titulo.length > 80) erros.push('O título precisa ter de 3 a 80 letras.');
  if (descricao.length > 400) erros.push('A descrição pode ter no máximo 400 letras.');
  if (!MODOS.includes(modo)) erros.push('Escolha como a missão é cumprida.');
  if (modo === 'selo' && !seloId) erros.push('Escolha o selo que cumpre esta missão.');
  if (recompensaTexto.length > 80) erros.push('A recompensa pode ter no máximo 80 letras.');
  if (rotuloReferencia.length > 60) erros.push('O texto do campo pode ter no máximo 60 letras.');
  const prazo = lerPrazo(corpo.prazo, erros);

  return {
    erros,
    missao: {
      titulo, descricao, modo,
      seloId: seloId || null,
      recompensaTexto, rotuloReferencia,
      repetivel: modo === 'aprovacao' ? !!corpo.repetivel : false,
      prazo,
      ativo: corpo.ativo === undefined ? true : !!corpo.ativo,
    },
  };
}

// Valida a edição de uma missão que já existe. O modo e o selo não mudam depois de criada
// (se precisar de outro jeito de cumprir, crie uma missão nova).
function lerEdicaoMissao(corpo, atual) {
  const erros = [];
  const saida = {};
  if (corpo.titulo !== undefined) {
    const t = String(corpo.titulo || '').trim();
    if (t.length < 3 || t.length > 80) erros.push('O título precisa ter de 3 a 80 letras.');
    else saida.titulo = t;
  }
  if (corpo.descricao !== undefined) {
    const d = String(corpo.descricao || '').trim();
    if (d.length > 400) erros.push('A descrição pode ter no máximo 400 letras.');
    else saida.descricao = d;
  }
  if (corpo.recompensaTexto !== undefined) {
    const r = String(corpo.recompensaTexto || '').trim();
    if (r.length > 80) erros.push('A recompensa pode ter no máximo 80 letras.');
    else saida.recompensaTexto = r;
  }
  if (corpo.rotuloReferencia !== undefined && atual.modo === 'aprovacao') {
    const r = String(corpo.rotuloReferencia || '').trim();
    if (r.length > 60) erros.push('O texto do campo pode ter no máximo 60 letras.');
    else saida.rotuloReferencia = r;
  }
  if (corpo.repetivel !== undefined && atual.modo === 'aprovacao') saida.repetivel = !!corpo.repetivel;
  if (corpo.prazo !== undefined) saida.prazo = lerPrazo(corpo.prazo, erros);
  if (corpo.ativo !== undefined) saida.ativo = !!corpo.ativo;
  return { saida, erros };
}

// Em que pé está a missão para uma pessoa, e se ela pode registrar um pedido agora.
function estadoDaMissao(missao, pedidos, seloIdsDaPessoa, hojeISO) {
  const fim = encerrada(missao, hojeISO);

  if (missao.modo === 'selo') {
    const tem = !!missao.seloId && seloIdsDaPessoa.has(missao.seloId);
    return { estado: tem ? 'concluida' : (fim ? 'encerrada' : 'disponivel'), podeEnviar: false };
  }

  const aprovadas = pedidos.filter((p) => p.status === 'aprovada').length;
  const pendentes = pedidos.filter((p) => p.status === 'pendente').length;
  let estado;
  if (missao.repetivel) estado = pendentes > 0 ? 'em_analise' : aprovadas > 0 ? 'concluida' : fim ? 'encerrada' : 'disponivel';
  else estado = aprovadas > 0 ? 'concluida' : pendentes > 0 ? 'em_analise' : fim ? 'encerrada' : 'disponivel';

  const podeEnviar = !fim && (missao.repetivel ? pendentes < MAX_PEDIDOS_PENDENTES : aprovadas === 0 && pendentes === 0);
  return { estado, podeEnviar };
}

// Valida o pedido que o colaborador registra.
function lerPedido(corpo, missao) {
  const erros = [];
  const referencia = String(corpo.referencia || '').trim();
  const mensagem = String(corpo.mensagem || '').trim();
  if (missao.rotuloReferencia && (referencia.length < 2 || referencia.length > 100)) {
    erros.push(`Preencha "${missao.rotuloReferencia}" (de 2 a 100 letras).`);
  }
  if (mensagem.length > 300) erros.push('A mensagem pode ter no máximo 300 letras.');
  return { erros, pedido: { referencia: missao.rotuloReferencia ? referencia : null, mensagem: mensagem || null } };
}

module.exports = {
  MODOS, MAX_PEDIDOS_PENDENTES, hojeBrasilia, diaDoPrazo, encerrada,
  lerMissao, lerEdicaoMissao, estadoDaMissao, lerPedido,
};
