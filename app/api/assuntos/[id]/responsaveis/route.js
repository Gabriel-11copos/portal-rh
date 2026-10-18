const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const { tabelaNaoExiste, modelosInstalados, conferirMaster } = require('../../../../../lib/acesso');

// Só master. Quem atende este assunto (as solicitações dele chegam para essas pessoas).
async function GET(req, { params }) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    let vinculos = [];
    if (modelosInstalados(prisma)) {
      try { vinculos = await prisma.assuntoResponsavel.findMany({ where: { assuntoId: params.id } }); }
      catch (err) { if (!tabelaNaoExiste(err)) throw err; }
    }
    return Response.json({ usuarioIds: vinculos.map((v) => v.usuarioId) });
  } catch (err) {
    console.error('Erro ao listar os responsáveis do assunto:', err);
    return Response.json({ erro: 'Não foi possível carregar.' }, { status: 500 });
  }
}

// Define quem atende o assunto (substitui a lista toda). Lista vazia = ninguém em particular (continua só no painel geral).
async function PUT(req, { params }) {
  try {
    const sessao = getSessaoRH();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    const bloqueio = await conferirMaster(prisma, sessao);
    if (bloqueio) return Response.json({ erro: bloqueio.erro }, { status: bloqueio.status });

    if (!modelosInstalados(prisma)) return Response.json({ erro: 'As tabelas de permissões ainda não foram criadas no banco.' }, { status: 409 });
    const assunto = await prisma.assunto.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!assunto) return Response.json({ erro: 'Assunto não encontrado.' }, { status: 404 });

    const corpo = await req.json();
    const pedidos = [...new Set((Array.isArray(corpo.usuarioIds) ? corpo.usuarioIds : []).filter((v) => v !== null && v !== undefined).map((v) => String(v).trim()).filter(Boolean))];
    if (pedidos.length > 50) return Response.json({ erro: 'Escolha no máximo 50 pessoas.' }, { status: 400 });
    const validos = pedidos.length ? await prisma.adminUsuario.findMany({ where: { id: { in: pedidos } }, select: { id: true } }) : [];
    if (validos.length !== pedidos.length) return Response.json({ erro: 'Alguma das pessoas escolhidas não existe mais.' }, { status: 400 });

    try {
      await prisma.assuntoResponsavel.deleteMany({ where: { assuntoId: assunto.id } });
      if (validos.length) await prisma.assuntoResponsavel.createMany({ data: validos.map((u) => ({ assuntoId: assunto.id, usuarioId: u.id })), skipDuplicates: true });
    } catch (err) {
      if (tabelaNaoExiste(err)) return Response.json({ erro: 'As tabelas de permissões ainda não foram criadas no banco.' }, { status: 409 });
      throw err;
    }
    return Response.json({ ok: true, total: validos.length });
  } catch (err) {
    console.error('Erro ao salvar os responsáveis do assunto:', err);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { GET, PUT };
