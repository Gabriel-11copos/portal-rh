const { processarPendentes } = require('../../../../lib/integracao');

// Chamada uma vez por dia pelo Vercel Cron (vercel.json): tenta de novo os avisos que ficaram na fila.
// (Além disso, a fila é tentada a cada novo aviso e a cada chamada do Portal do Gestor.)
async function handler(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  const r = await processarPendentes(50);
  return Response.json(r);
}

module.exports = { GET: handler, POST: handler };
