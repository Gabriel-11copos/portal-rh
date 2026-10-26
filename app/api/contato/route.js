const { prisma } = require('../../../lib/db');
const { getSessaoColaborador } = require('../../../lib/auth');
const C = require('../../../lib/contatos');

// O WhatsApp do próprio colaborador: ver (já com o número que o RH tem na lista, para ele só conferir) e confirmar/corrigir.
// Só mexe nos dados de quem está logado.
async function GET() {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    return Response.json(await C.contatoParaTela(prisma, sessao.id));
  } catch (err) {
    if (err && (err.code === 'P2021' || /does not exist/i.test(String(err.message)))) return Response.json({ disponivel: false });   // tabela ainda não instalada: a tela não mostra nada
    console.error('Erro ao ler o contato do colaborador:', err && err.code);
    return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 });
  }
}

async function PUT(req) {
  try {
    const sessao = getSessaoColaborador();
    if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!C.instalado(prisma)) return Response.json({ erro: 'Este recurso ainda não está disponível.' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo !== 'object') return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
    const r = await C.confirmarContato(prisma, sessao.id, { telefone: corpo.telefone, whatsappAtivo: corpo.whatsappAtivo });
    if (!r.ok) return Response.json({ erro: r.erro }, { status: r.status });
    return Response.json({ ok: true, telefone: r.telefone, whatsappAtivo: r.whatsappAtivo });
  } catch (err) {
    console.error('Erro ao salvar o contato do colaborador:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { GET, PUT };
