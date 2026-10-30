const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');

// Valores por viagem e dados das unidades (endereço do trabalho, razão social e CNPJ para o termo).
async function GET() {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try { return E.instalado(prisma) ? Response.json(await E.lerConfig(prisma)) : Response.json({ instalado: false }); }
  catch (err) { console.error('Erro ao ler a configuração do vale-transporte:', err && err.code); return Response.json({ erro: 'Não foi possível carregar agora.' }, { status: 500 }); }
}

async function PUT(req) {
  const rh = getSessaoRH();
  if (!rh) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  let corpo = null;
  try { corpo = await req.json(); } catch { corpo = null; }
  if (!corpo || typeof corpo !== 'object') return Response.json({ erro: 'Envie os dados.' }, { status: 400 });
  try {
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está instalado.' }, { status: 503 });
    if (corpo.regras) { const r = await E.salvarRegras(prisma, corpo.regras); return r.ok ? Response.json({ ok: true }) : Response.json({ erro: r.erros[0], erros: r.erros }, { status: r.status }); }
    if (corpo.unidade) { const r = await E.salvarUnidade(prisma, corpo.unidade); return r.ok ? Response.json({ ok: true }) : Response.json({ erro: r.erro }, { status: r.status }); }
    return Response.json({ erro: 'Nada para salvar.' }, { status: 400 });
  } catch (err) {
    console.error('Erro ao salvar a configuração do vale-transporte:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { GET, PUT };
