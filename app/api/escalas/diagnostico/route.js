const { getSessaoRH } = require('../../../../lib/auth');
const { consultarEscalas, descreverResposta } = require('../../../../lib/escalas');

// Ferramenta de teste (só RH): consulta o escalas-app para um dia e devolve um RESUMO da
// resposta (campos, quantidade e uma amostra com CPF e nome mascarados). Serve para
// confirmar o formato real da API antes de montar a tela do colaborador.
async function GET(req) {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

  const url = new URL(req.url);
  const data = url.searchParams.get('data') || '';
  const lojaCodigo = url.searchParams.get('lojaCodigo') || '';
  const incluirAusencias = url.searchParams.get('incluirAusencias') === '1';

  const r = await consultarEscalas({ data, lojaCodigo, incluirAusencias });

  return Response.json({
    consulta: { data, lojaCodigo: lojaCodigo || '(nenhum)', incluirAusencias },
    ok: r.ok,
    status: r.status,
    tempoMs: r.ms,
    erro: r.erro || null,
    mensagem: r.mensagem || null,
    resposta: r.corpo !== undefined && r.corpo !== null ? descreverResposta(r.corpo) : null,
    textoBruto: r.textoBruto || null,
  });
}

module.exports = { GET };
