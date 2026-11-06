// Recebe da IA do WhatsApp o saldo do vale-transporte confirmado pelo colaborador.
// A IA já validou a foto (data/hora, tela correta, confirmação com o colaborador).
// O portal salva as fotos no Drive, registra o saldo e sinaliza divergências ao RH.

const { prisma } = require('../../../lib/db');
const { checarChave } = require('../../../lib/integracao');
const C = require('../../../lib/contatos');
const E = require('../../../lib/vtDados');
const V = require('../../../lib/vt');
const { guardarDocumento } = require('../../../lib/guardarDocumento');
const { normalizarTelefone } = require('../../../lib/telefone');

const MAX_FOTO = 10 * 1024 * 1024;   // 10 MB: a foto vem do WhatsApp, pode ser maior que a do portal
const CONFIANCAS = ['alta', 'media', 'baixa'];
const centavos = (v) => { if (v === null || v === undefined) return null; const n = Math.round(Number(v)); return isNaN(n) ? null : n; };   // negativo é válido (Jaé no débito)
const texto = (v, max = 200) => { const s = String(v == null ? '' : v).trim(); return s.length > 0 && s.length <= max ? s : null; };

async function POST(req) {
  try { return await _post(req); } catch (err) { console.error('[whatsapp-vt-saldo] erro interno:', err); return Response.json({ erro: 'erro_interno', mensagem: String(err && err.message || err) }, { status: 500 }); }
}
async function _post(req) {
  const negado = checarChave(req);
  if (negado) return negado;

  let corpo;
  try { corpo = await req.json(); } catch { return Response.json({ erro: 'json_invalido', mensagem: 'Envie um JSON válido.' }, { status: 400 }); }
  console.log('[whatsapp-vt-saldo] recebido:', JSON.stringify({ telefone: corpo && corpo.telefone, temFotoJae: !!(corpo && corpo.fotoJae), temFotoRio: !!(corpo && corpo.fotoRiocard), saldoJae: corpo && corpo.saldoJae, saldoRiocard: corpo && corpo.saldoRiocard }));
  if (!corpo || typeof corpo !== 'object') return Response.json({ erro: 'json_invalido', mensagem: 'Envie um JSON válido.' }, { status: 400 });

  // 1. Identifica o colaborador pelo telefone
  const numero = normalizarTelefone(corpo.telefone);
  if (!numero) return Response.json({ erro: 'telefone_invalido', mensagem: 'Informe o telefone com DDD. Recebido: ' + String(corpo.telefone || '') }, { status: 400 });
  let achados = await C.buscarPorTelefone(prisma, numero);
  // tenta sem o código do país se não achou (plataforma pode mandar só DDD + número)
  if (achados.length === 0 && numero.startsWith('55') && numero.length >= 12) achados = await C.buscarPorTelefone(prisma, numero.slice(2));
  console.log('[whatsapp-vt-saldo] telefone:', numero, '| achados:', achados.length);
  if (achados.length === 0) return Response.json({ erro: 'nao_encontrado', mensagem: 'Número não encontrado no cadastro: ' + numero }, { status: 404 });
  if (achados.length > 1) return Response.json({ erro: 'telefone_compartilhado', mensagem: 'Número cadastrado para mais de uma pessoa.' }, { status: 409 });
  const { colaborador } = achados[0];

  // 2. Verifica se há coleta aberta para esta pessoa
  const coleta = await E.coletaAtiva(prisma, 'saldo');
  const foraDoPrazo = !coleta || !coleta.ativa;   // aceita mesmo fora do prazo, mas marca
  const coletaId = coleta ? coleta.id : null;

  // 3. Lê e valida os saldos
  const reg = await prisma.transporteColaborador.findUnique({ where: { colaboradorId: colaborador.id } });
  if (!reg || !reg.usaVT || !V.MODALIDADES_COM_CARTAO?.includes(reg.modalidade)) {
    // aceita mesmo assim: o RH decide o que fazer
  }
  const precisaJae = reg && reg.modalidade !== 'riocard';
  const precisaRio = reg && reg.modalidade !== 'jae';
  const jae = centavos(corpo.saldoJae);
  const rio = centavos(corpo.saldoRiocard);
  const leituraJae = centavos(corpo.leituraJae);
  const leituraRio = centavos(corpo.leituraRiocard);
  const confiancaJae = CONFIANCAS.includes(corpo.confiancaJae) ? corpo.confiancaJae : null;
  const confiancaRio = CONFIANCAS.includes(corpo.confiancaRiocard) ? corpo.confiancaRiocard : null;
  const divergencia = corpo.divergencia === true;
  const conferir = divergencia || confiancaJae === 'baixa' || confiancaRio === 'baixa';

  // 4. Salva as fotos no Drive (mesma pasta de Vale-Transporte do colaborador)
  const competencia = E.competenciaDe(coleta ? coleta.criadaEm : new Date());
  const dia = E.agoraBR(coleta ? new Date(coleta.criadaEm) : new Date());
  const rotulo = `${String(dia.dia).padStart(2, '0')}-${String(dia.mes).padStart(2, '0')}`;

  async function salvarFoto(base64, cartao) {
    if (!base64) return null;
    try {
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.length > MAX_FOTO) return null;
      const ext = buffer[0] === 0xff ? 'jpg' : buffer[0] === 0x89 ? 'png' : 'jpg';
      const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
      const r = await guardarDocumento(prisma, { colaborador, tipo: `${V.PREFIXO_DOC_SALDO}${rotulo} ${cartao} (WhatsApp)`, competencia, buffer, extensao: ext, mimeType: mime, avisarColaborador: false });
      return r.ok ? r.url : null;
    } catch { return null; }
  }

  const [urlJae, urlRio] = await Promise.all([salvarFoto(corpo.fotoJae, 'JAE'), salvarFoto(corpo.fotoRiocard, 'RIOCARD')]);

  // 5. Registra no banco
  const printJae = corpo.dataHoraPrintJae ? new Date(corpo.dataHoraPrintJae) : null;
  const printRio = corpo.dataHoraPrintRiocard ? new Date(corpo.dataHoraPrintRiocard) : null;
  const dados = { colaboradorId: colaborador.id, saldoJaeCentavos: precisaJae ? jae : null, saldoRiocardCentavos: precisaRio ? rio : null, leituraJaeCentavos: leituraJae, leituraRiocardCentavos: leituraRio, confiancaJae, confiancaRiocard: confiancaRio, fotoJaeUrl: urlJae, fotoRiocardUrl: urlRio, dataHoraPrintJae: printJae && !isNaN(printJae) ? printJae : null, dataHoraPrintRiocard: printRio && !isNaN(printRio) ? printRio : null, divergencia, foraDoPrazo, origem: 'whatsapp' };

  if (coletaId) {
    // dentro de uma coleta: usa a mesma tabela SaldoVT para o RH ver junto com os do portal
    const existente = await prisma.saldoVT.findFirst({ where: { coletaId, colaboradorId: colaborador.id } });
    const saldoVT = { saldoJaeCentavos: precisaJae ? jae : null, saldoRiocardCentavos: precisaRio ? rio : null, anexos: JSON.stringify([...(urlJae ? [{ url: urlJae, nome: 'Foto JAE (WhatsApp)' }] : []), ...(urlRio ? [{ url: urlRio, nome: 'Foto RIOCARD (WhatsApp)' }] : [])]), status: conferir ? 'conferir' : 'enviado', motivoRefazer: null, informadoEm: new Date() };
    if (existente) await prisma.saldoVT.update({ where: { id: existente.id }, data: saldoVT });
    else await prisma.saldoVT.create({ data: { coletaId, colaboradorId: colaborador.id, ...saldoVT } });
  }

  // salva o registro detalhado do WhatsApp (leitura da IA, confiança, divergência etc.)
  const existenteW = coletaId ? await prisma.saldoVTWhatsapp.findFirst({ where: { coletaId, colaboradorId: colaborador.id } }) : null;
  const dadosW = { ...dados, ...(coletaId ? { coletaId } : { coletaId: 'sem-coleta' }) };
  if (existenteW) await prisma.saldoVTWhatsapp.update({ where: { id: existenteW.id }, data: dadosW });
  else await prisma.saldoVTWhatsapp.create({ data: dadosW });

  console.log(`[whatsapp-vt-saldo] colaborador=${colaborador.id} coleta=${coletaId || 'fora'} conferir=${conferir} foraDoPrazo=${foraDoPrazo}`);
  return Response.json({ ok: true, conferir, foraDoPrazo, coletaId, mensagem: conferir ? 'Gravado. Marcado para conferência do RH.' : 'Gravado com sucesso.' });
}

module.exports = { POST };
