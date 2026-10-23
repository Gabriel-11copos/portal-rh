const crypto = require('crypto');
const { prisma } = require('../../../lib/db');
const { getSessaoRH, getSessaoColaborador } = require('../../../lib/auth');
const { enviarEmail } = require('../../../lib/email');
const { notificarLote } = require('../../../lib/whatsapp');
const { modoDeAcesso } = require('../../../lib/contexto');

async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { colaboradorIds, assunto, texto, anexos } = await req.json();

  if (!colaboradorIds?.length) {
    return Response.json({ erro: 'Selecione pelo menos um colaborador.' }, { status: 400 });
  }

  const loteId = crypto.randomUUID();
  const destinatarios = await prisma.colaborador.findMany({ where: { id: { in: colaboradorIds } } });

  const avisosWhatsapp = [];
  for (const colaborador of destinatarios) {
    const comunicadoCriado = await prisma.comunicado.create({
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
    avisosWhatsapp.push({ evento: 'comunicado.novo', chave: `comunicado:${comunicadoCriado.id}`, colaborador, dados: { assunto } });
  }
  // WhatsApp: um aviso curto para cada destinatário (o que não couber agora fica na fila e sai em seguida)
  await notificarLote(prisma, avisosWhatsapp);

  return Response.json({ ok: true, enviados: destinatarios.length });
}

// Lista comunicados. Telas do painel (RH): todos. Telas do colaborador: só os do colaborador logado,
// mesmo que a pessoa também tenha o login do RH aberto no mesmo navegador.
async function GET(req) {
  const modo = modoDeAcesso(req, { rh: getSessaoRH(), colaborador: getSessaoColaborador() });

  if (modo === 'rh') {
    const comunicados = await prisma.comunicado.findMany({
      include: { colaborador: true, anexos: true },
      orderBy: { data: 'desc' },
    });
    // a senha (criptografada) do colaborador nunca sai do servidor
    return Response.json(comunicados.map((c) => {
      if (!c.colaborador) return c;
      const { senhaHash, ...colaborador } = c.colaborador;
      return { ...c, colaborador };
    }));
  }

  if (modo === 'colaborador') {
    const comunicados = await prisma.comunicado.findMany({
      where: { colaboradorId: getSessaoColaborador().id },
      include: { anexos: true },
      orderBy: { data: 'desc' },
    });
    return Response.json(comunicados);
  }

  return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
}

module.exports = { POST, GET };
