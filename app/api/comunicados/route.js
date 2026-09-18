const { prisma } = require('../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');

// RH envia um comunicado (aviso ou documento) para um colaborador específico ou uma loja inteira.
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { colaboradorId, loja, assunto, texto, anexos } = await req.json();

  let destinatarios = [];
  if (colaboradorId) {
    destinatarios = [await prisma.colaborador.findUnique({ where: { id: colaboradorId } })];
  } else if (loja) {
    destinatarios = await prisma.colaborador.findMany({ where: { loja } });
  } else {
    return Response.json({ erro: 'Informe um colaborador ou uma loja.' }, { status: 400 });
  }

  for (const colaborador of destinatarios) {
    const comunicado = await prisma.comunicado.create({
      data: {
        colaboradorId: colaborador.id,
        loja: loja || null,
        assunto,
        texto,
        anexos: {
          create: (anexos || []).map((a) => ({
            linkDrive: a.link,
            nomeArquivo: a.nomeArquivo,
            enviadoPor: 'rh',
          })),
        },
      },
    });

    await enviarEmail(
      colaborador.email,
      `Comunicado do RH: ${assunto}`,
      `<p>Olá ${colaborador.nome},</p><p>${texto}</p><p>Acesse o portal para ver os detalhes.</p>`
    );
  }

  return Response.json({ ok: true, enviados: destinatarios.length });
}

// Lista comunicados: do colaborador logado, ou todos (RH).
async function GET() {
  const sessaoColaborador = getSessaoColaborador();
  const sessaoRH = getSessaoRH();

  if (sessaoRH) {
    const comunicados = await prisma.comunicado.findMany({
      include: { colaborador: true, anexos: true },
      orderBy: { data: 'desc' },
    });
    return Response.json(comunicados);
  }

  if (sessaoColaborador) {
    const comunicados = await prisma.comunicado.findMany({
      where: { colaboradorId: sessaoColaborador.id },
      include: { anexos: true },
      orderBy: { data: 'desc' },
    });
    return Response.json(comunicados);
  }

  return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
}

module.exports = { POST, GET };
