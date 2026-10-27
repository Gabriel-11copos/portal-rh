// Abrir um pedido e escrever mensagens nele: o MESMO caminho para o portal e para o WhatsApp.
// Assim a triagem (prazo, resposta automática, destino), o e-mail, o aviso ao Portal do Gestor e o aviso de WhatsApp
// são idênticos, venha o pedido de onde vier.

const { enviarEmail } = require('./email');
const { somarDiasUteis } = require('./feriados');
const { destinoFinal, avisarGestor } = require('./integracao');
const { notificar } = require('./whatsapp');

// Cria a solicitação com a triagem automática do assunto. "colaborador" é o cadastro completo (precisa de id, nome, email e loja).
// avisarWhatsapp=false: quando o pedido nasce no próprio WhatsApp, a IA já confirma na conversa (não manda um segundo aviso).
async function abrirSolicitacao(prisma, { colaborador, assunto, descricao, anexos, emailContato, whatsapp, extrasJson, avisarWhatsapp = true }) {
  const prazo = somarDiasUteis(new Date(), assunto.prazoPadraoDias);

  // Pra onde vai o pedido: o assunto manda pro gestor da loja (o Administrativo vai pro RH).
  const destino = destinoFinal(assunto, colaborador.loja);

  const solicitacao = await prisma.solicitacao.create({
    data: {
      colaboradorId: colaborador.id,
      destino,
      dadosExtras: extrasJson || null,
      assuntoId: assunto.id,
      descricao,
      emailContato,
      whatsapp,
      prazo,
      status: assunto.respostaAutomatica ? 'respondida' : 'aberta',
      vistoColaborador: !assunto.respostaAutomatica,
      anexos: {
        create: (anexos || []).map((a) => ({
          linkDrive: a.link,
          nomeArquivo: a.nomeArquivo,
          enviadoPor: 'colaborador',
        })),
      },
    },
  });

  // Triagem automática: se o assunto já tem resposta padrão configurada, responde na hora.
  if (assunto.respostaAutomatica) {
    await prisma.resposta.create({
      data: {
        solicitacaoId: solicitacao.id,
        texto: assunto.respostaAutomatica,
        automatica: true,
      },
    });
  }

  await enviarEmail(
    colaborador.email,
    `Solicitação recebida: ${assunto.nome}`,
    `<p>Olá ${colaborador.nome}, recebemos sua solicitação sobre <b>${assunto.nome}</b>.</p>
     ${assunto.respostaAutomatica ? `<p>${assunto.respostaAutomatica}</p>` : '<p>Ela será analisada pela nossa equipe em breve.</p>'}`
  );

  await avisarGestor('solicitacao.criada', solicitacao.id);

  // WhatsApp: confirma que o pedido foi recebido (com o número, para acompanhar)
  if (avisarWhatsapp) await notificar(prisma, { evento: 'solicitacao.criada', chave: `criada:${solicitacao.id}`, colaborador, dados: { numero: solicitacao.numero } });

  return solicitacao;
}

// O colaborador escreve (e/ou anexa) algo num pedido dele que ainda está aberto.
async function adicionarMensagemDoColaborador(prisma, { colaborador, solicitacaoId, texto, anexos }) {
  const solicitacao = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao || solicitacao.colaboradorId !== colaborador.id) {
    return { ok: false, status: 404, erro: 'Solicitação não encontrada.' };
  }
  if (solicitacao.status === 'encerrada') {
    return { ok: false, status: 400, erro: 'Esta solicitação já foi encerrada.' };
  }

  let respostaCriada = null;
  if (texto && texto.trim()) {
    respostaCriada = await prisma.resposta.create({
      data: {
        solicitacaoId,
        texto,
        autor: 'colaborador',
        nomeAutor: colaborador.nome,
        automatica: false,
      },
    });
  }

  if (anexos?.length) {
    await prisma.anexo.createMany({
      data: anexos.map((a) => ({
        solicitacaoId,
        linkDrive: a.link,
        nomeArquivo: a.nomeArquivo,
        enviadoPor: 'colaborador',
      })),
    });
  }

  const atualizada = await prisma.solicitacao.update({
    where: { id: solicitacaoId },
    data: { status: 'em_analise', vistoColaborador: true },
    include: { assunto: true, colaborador: true },
  });

  await avisarGestor('solicitacao.mensagem', solicitacaoId, {
    mensagem: {
      id: respostaCriada ? respostaCriada.id : 'a-' + Date.now(),
      texto: respostaCriada ? respostaCriada.texto : '',
      autor: 'colaborador',
      nomeAutor: colaborador.nome,
      data: new Date().toISOString(),
      anexos: (anexos || []).map((a) => ({ nome: a.nomeArquivo, link: a.link })),
    },
  });

  return { ok: true, solicitacao: atualizada };
}

module.exports = { abrirSolicitacao, adicionarMensagemDoColaborador };
