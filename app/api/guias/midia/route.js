const { prisma } = require('../../../../lib/db');
const { getSessaoRH } = require('../../../../lib/auth');
const { MAX_BYTES, classificarMidia, assinaturaConfere, nomeSeguroDoArquivo } = require('../../../../lib/guias');

// Só RH: envia uma imagem ou um arquivo (até 4 MB) para usar num guia.
// Arquivos maiores devem entrar como link (ex: do Google Drive).
async function POST(req) {
  try {
    if (!getSessaoRH()) return Response.json({ erro: 'Não autenticado.' }, { status: 401 });

    const form = await req.formData();
    const arquivo = form.get('arquivo');
    if (!arquivo || typeof arquivo === 'string' || typeof arquivo.arrayBuffer !== 'function') {
      return Response.json({ erro: 'Escolha um arquivo.' }, { status: 400 });
    }
    if (arquivo.size > MAX_BYTES) {
      return Response.json({ erro: 'O arquivo passa de 4 MB. Para arquivos grandes, use um link (por exemplo, do Google Drive).' }, { status: 413 });
    }

    const tipo = classificarMidia(arquivo.type, arquivo.name);
    if (!tipo) {
      return Response.json({ erro: 'Tipo de arquivo não permitido. Use imagem (jpg, png, webp, gif), PDF, Word, Excel, PowerPoint, txt ou csv.' }, { status: 400 });
    }

    const dados = Buffer.from(await arquivo.arrayBuffer());
    if (dados.length === 0) return Response.json({ erro: 'O arquivo está vazio.' }, { status: 400 });
    if (!assinaturaConfere(tipo.tipoMime, dados)) {
      return Response.json({ erro: 'O conteúdo do arquivo não bate com o tipo dele. Confira se não está corrompido.' }, { status: 400 });
    }

    const nome = nomeSeguroDoArquivo(arquivo.name);
    const criada = await prisma.guiaMidia.create({
      data: { nome, tipoMime: tipo.tipoMime, tamanho: dados.length, dados },
    });
    return Response.json({ id: criada.id, nome, tipoMime: tipo.tipoMime, tamanho: dados.length, classe: tipo.classe });
  } catch (err) {
    console.error('Erro ao enviar arquivo do guia:', err);
    return Response.json({ erro: 'Não foi possível enviar o arquivo.' }, { status: 500 });
  }
}

module.exports = { POST };
