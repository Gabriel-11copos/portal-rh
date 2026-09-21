const crypto = require('crypto');
const { prisma } = require('../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');

async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { colaboradorIds, assunto, texto, anexos } = await req.json();

  if (!colaboradorIds?.length) {
    return Response.json({ erro: 'Selecione pelo menos um colaborador.' }, { status: 400 });
  }

  const loteId = crypto.randomUUID();
  const destinatarios = await prisma.colaborador.findMany({ where: { id: { in: colaboradorIds } } });

  for (const colaborador of destinatarios) {
    await prisma.comunicado.create({
      data: {
        loteId,
        colaboradorId: colaborador.id,
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
