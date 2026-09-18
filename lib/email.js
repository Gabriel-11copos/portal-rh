const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarEmail(destinatario, assunto, mensagemHtml) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_REMETENTE || 'Portal RH <onboarding@resend.dev>',
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
