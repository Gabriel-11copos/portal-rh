const { prisma } = require('../../../../lib/db');
const { getSessaoColaborador } = require('../../../../lib/auth');
const E = require('../../../../lib/vtDados');

// O colaborador informa o saldo do cartão e anexa a foto ou o PDF (de 1 a 2 arquivos). Os arquivos ficam no Drive privado.
async function POST(req) {
  const s = getSessaoColaborador();
  if (!s) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    const c = await prisma.colaborador.findUnique({ where: { id: s.id } });
    if (!c || c.ativo === false) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!E.instalado(prisma)) return Response.json({ erro: 'O vale-transporte ainda não está disponível.' }, { status: 503 });
    let form;
    try { form = await req.formData(); } catch { return Response.json({ erro: 'Envio inválido. Tente de novo.' }, { status: 400 }); }
    const enviados = form.getAll('arquivo').filter((f) => f && typeof f !== 'string' && f.size > 0);
    if (enviados.length > 3) return Response.json({ erro: 'Anexe no máximo 2 arquivos.' }, { status: 400 });
    const arquivos = [];
    for (const f of enviados) arquivos.push({ buffer: Buffer.from(await f.arrayBuffer()), nome: String(f.name || 'arquivo').slice(0, 80) });
    const r = await E.registrarSaldo(prisma, c, { coletaId: String(form.get('coletaId') || ''), saldoJae: form.get('saldoJae'), saldoRiocard: form.get('saldoRiocard'), arquivos });
    if (!r.ok) return Response.json({ erro: r.erros[0], erros: r.erros }, { status: r.status });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar o saldo do vale-transporte:', err && err.code);
    return Response.json({ erro: 'Não foi possível enviar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}

module.exports = { POST };
