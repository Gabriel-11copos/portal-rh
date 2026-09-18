const { prisma } = require('../../../lib/db');
const { getSessaoRH, gerarHash } = require('../../../lib/auth');

// RH cadastra um colaborador. Login = CPF (campo "matricula"). Se a senha não for
// informada, usa automaticamente os 6 primeiros dígitos do CPF.
async function POST(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { nome, matricula, email, loja, cargo, dataAdmissao, senha } = await req.json();
  const cpfLimpo = matricula.replace(/\D/g, '');
  const senhaFinal = senha && senha.trim() ? senha : cpfLimpo.slice(0, 6);
  const senhaHash = await gerarHash(senhaFinal);

  const colaborador = await prisma.colaborador.create({
    data: {
      nome,
      matricula: cpfLimpo,
      email,
      loja,
      cargo,
      dataAdmissao: dataAdmissao ? new Date(dataAdmissao) : null,
      senhaHash,
    },
  });

  return Response.json({ ok: true, id: colaborador.id });
}

async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const colaboradores = await prisma.colaborador.findMany({ orderBy: { nome: 'asc' } });
  return Response.json(colaboradores);
}

module.exports = { POST, GET };
