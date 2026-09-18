const nodemailer = require('nodemailer');

// Envia e-mails usando uma conta Gmail/Google Workspace comum, autenticada com uma
// "senha de app" (não é a senha normal da conta). Configurada em EMAIL_USER e
// EMAIL_APP_PASSWORD nas variáveis de ambiente.
function getTransportador() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
}

async function enviarEmail(destinatario, assunto, mensagemHtml) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log('E-mail não configurado ainda — notificação não enviada.');
    return;
  }
  try {
    const transportador = getTransportador();
    await transportador.sendMail({
      from: process.env.EMAIL_REMETENTE || `Portal RH <${process.env.EMAIL_USER}>`,
      to: destinatario,
      subject: assunto,
      html: mensagemHtml,
    });
  } catch (err) {
    // Não travar o fluxo do app caso o e-mail falhe — só registrar no log.
    console.error('Falha ao enviar e-mail:', err);
  }
}

module.exports = { enviarEmail };
