const { prisma } = require('../../../../../lib/db');
const { getSessaoRH } = require('../../../../../lib/auth');
const M = require('../../../../../lib/moedas');

const CAMPOS = ['nome', 'descricao', 'custo', 'tipo', 'valorCentavos', 'estoque', 'ativo'];

// Edita um prêmio (custo, estoque, nome, ativo...). Mudar o custo NÃO muda o que já foi trocado: cada troca guarda o custo da hora.
// O prêmio é validado já com a mudança aplicada (ex.: virar "saldo no Zig" exige o valor em reais) e só os campos enviados são gravados.
async function PATCH(req, { params }) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
    if (!M.moedasInstaladas(prisma)) return Response.json({ erro: 'As tabelas das moedas ainda não foram instaladas (falta rodar o SQL).' }, { status: 503 });
    let corpo = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
    const enviados = CAMPOS.filter((k) => Object.prototype.hasOwnProperty.call(corpo, k));
    if (enviados.length === 0) return Response.json({ erro: 'Nada para alterar.' }, { status: 400 });

    const existente = await prisma.moedaPremio.findUnique({ where: { id: params.id } });
    if (!existente) return Response.json({ erro: 'Prêmio não encontrado.' }, { status: 404 });
    const unido = { ...existente };
    for (const k of enviados) unido[k] = corpo[k];
    const { erros, dados } = M.validarPremio(unido);
    if (erros.length > 0) return Response.json({ erro: erros.join(' ') }, { status: 400 });

    const alterar = {};
    for (const k of enviados) alterar[k] = dados[k];
    if (enviados.includes('tipo')) alterar.valorCentavos = dados.valorCentavos;   // trocar o tipo muda também o valor em reais
    await prisma.moedaPremio.update({ where: { id: existente.id }, data: alterar });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Erro ao editar o prêmio:', err && err.code);
    return Response.json({ erro: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

module.exports = { PATCH };
