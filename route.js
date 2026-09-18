const { cookies } = require('next/headers');

async function POST() {
  cookies().delete('sessao_colaborador');
  cookies().delete('sessao_rh');
  return Response.json({ ok: true });
}

module.exports = { POST };
