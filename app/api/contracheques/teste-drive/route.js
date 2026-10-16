const { getSessaoRH } = require('../../../../lib/auth');
const drive = require('../../../../lib/driveContracheques');

// Só RH. Confirma que o portal consegue gravar no Google Drive (cria e apaga um arquivinho de teste).
async function GET() {
  if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  try {
    await drive.testarConexao();
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Teste de conexão com o Drive falhou:', err);
    return Response.json({ ok: false, erro: drive.explicar(err) }, { status: 502 });
  }
}

module.exports = { GET };
