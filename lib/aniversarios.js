// Parabéns de aniversário: decide quem faz aniversário hoje e cria o comunicado.
// O comunicado só é criado NO DIA do aniversário (horário de Brasília).
// A data de nascimento é guardada à meia-noite UTC, por isso mês e dia são lidos em UTC.

const FUSO = 'America/Sao_Paulo';
const ARTE = '/aniversario.jpg';   // arquivo em public/aniversario.jpg (para trocar a arte, troque esse arquivo)

// Data de hoje no horário de Brasília (AAAA-MM-DD). O servidor roda em UTC.
function hojeBrasilia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
}

function bissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function mesEDia(dataNascimento) {
  const d = new Date(dataNascimento);
  if (isNaN(d)) return null;
  return { mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

// Quem nasceu em 29/02 comemora em 28/02 nos anos que não são bissextos.
function ehAniversario(dataNascimento, hojeISO) {
  if (!dataNascimento) return false;
  const n = mesEDia(dataNascimento);
  if (!n) return false;
  const [ano, mes, dia] = hojeISO.split('-').map(Number);
  if (n.mes === mes && n.dia === dia) return true;
  return n.mes === 2 && n.dia === 29 && mes === 2 && dia === 28 && !bissexto(ano);
}

function primeiroNome(c) {
  const base = String(c.nomeSocial || c.nome || '').trim();
  return base.split(/\s+/)[0] || '';
}

// Texto do comunicado (a arte com o mesmo texto aparece como anexo).
function montarComunicado(c) {
  const nome = primeiroNome(c);
  return {
    assunto: 'Feliz aniversário! 🎂',
    texto:
      `Parabéns${nome ? `, ${nome}` : ''}! Desejamos um novo ciclo cheio de felicidade, saúde e grandes conquistas. ` +
      'É um prazer contar com você em nosso time! Seu BrewCheque já está disponível no Zig.\n\n' +
      'Gente, Gestão & Cultura',
  };
}

// Cria o comunicado de aniversário se a pessoa ainda não recebeu um neste ano.
// Funciona tanto quando chamada pelo agendador quanto quando a pessoa abre o app no dia.
async function garantirComunicado(prisma, colaborador, hojeISO) {
  const ano = hojeISO.slice(0, 4);
  const existente = await prisma.comunicado.findFirst({
    where: { colaboradorId: colaborador.id, loteId: { startsWith: `aniversario-${ano}-` } },
    select: { id: true },
  });
  if (existente) return { criado: false };

  const { assunto, texto } = montarComunicado(colaborador);
  const novo = await prisma.comunicado.create({
    data: {
      loteId: `aniversario-${hojeISO}`,
      colaboradorId: colaborador.id,
      loja: colaborador.loja,
      assunto,
      texto,
      lido: false,
      data: new Date(),
    },
  });
  try {
    await prisma.anexo.create({
      data: { comunicadoId: novo.id, linkDrive: ARTE, nomeArquivo: 'Cartão de aniversário.jpg', enviadoPor: 'rh' },
    });
  } catch (err) {
    console.error('Comunicado de aniversário criado sem o anexo da arte:', err);
  }
  return { criado: true };
}

// Cria os comunicados de todos os aniversariantes ativos do dia.
async function criarComunicadosDoDia(prisma, hojeISO) {
  const candidatos = await prisma.colaborador.findMany({
    where: { ativo: true, dataNascimento: { not: null } },
    select: { id: true, nome: true, nomeSocial: true, loja: true, dataNascimento: true },
  });
  const doDia = candidatos.filter((c) => ehAniversario(c.dataNascimento, hojeISO));

  let criados = 0;
  let jaExistiam = 0;
  let falhas = 0;
  for (const c of doDia) {
    try {
      const r = await garantirComunicado(prisma, c, hojeISO);
      if (r.criado) criados++;
      else jaExistiam++;
    } catch (err) {
      falhas++;
      console.error('Falha ao criar o comunicado de aniversário:', err);
    }
  }
  return { data: hojeISO, aniversariantes: doDia.length, criados, jaExistiam, falhas };
}

// Lista para o RH: aniversariantes ativos de um mês, em ordem de dia.
function aniversariantesDoMes(colaboradores, mes) {
  return colaboradores
    .map((c) => ({ c, n: mesEDia(c.dataNascimento) }))
    .filter((x) => x.n && x.n.mes === mes)
    .sort((a, b) => a.n.dia - b.n.dia || String(a.c.nomeSocial || a.c.nome).localeCompare(String(b.c.nomeSocial || b.c.nome), 'pt-BR'))
    .map((x) => ({
      id: x.c.id,
      nome: x.c.nomeSocial || x.c.nome,
      loja: x.c.loja,
      cargo: x.c.cargo || null,
      dia: x.n.dia,
      mes: x.n.mes,
    }));
}

module.exports = {
  ARTE,
  hojeBrasilia,
  ehAniversario,
  primeiroNome,
  montarComunicado,
  garantirComunicado,
  criarComunicadosDoDia,
  aniversariantesDoMes,
};
