const { Resend } = require('resend');

async function enviarEmail(destinatario, assunto, mensagemHtml) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY não configurada ainda — e-mail não enviado.');
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_REMETENTE || 'Portal RH <onboarding@resend.dev>',
      to: destinatario,
      subject: assunto,
      html: mensagemHtml,
    });
  } catch (err) {
    console.error('Falha ao enviar e-mail:', err);
  }
}

module.exports = { enviarEmail };