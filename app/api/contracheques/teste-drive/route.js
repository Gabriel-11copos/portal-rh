const { getSessaoRH } = require('../../../../lib/auth');
const drive = require('../../../../lib/driveContracheques');

// Só RH. Confere a conexão com o Google Drive em passos e devolve o que encontrou (qual conta, qual pasta, qual passo falhou).
async function GET() {
  if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    const r = await drive.diagnosticar();
    return Response.json(r, { status: r.ok ? 200 : 502 });
  } catch (err) {
    console.error('Teste de conexão com o Drive falhou:', err);
    return Response.json({ ok: false, erro: drive.explicar(err), passos: [] }, { status: 502 });
  }
}

module.exports = { GET };
