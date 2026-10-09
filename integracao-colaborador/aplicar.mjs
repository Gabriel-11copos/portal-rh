// Aplicador da integração (Portal do Colaborador -> Portal do Gestor).
//
// Uso (PowerShell):   node aplicar.mjs "C:\caminho\da\pasta\portal-rh"
//
// O que faz: cria os arquivos novos e INSERE poucas linhas em arquivos que já existem.
// Não substitui nenhum arquivo inteiro. Antes de escrever qualquer coisa, confere se TODOS os pontos
// de inserção existem no seu código; se algum não existir, PARA sem mexer em nada e diz qual.
// Antes de alterar, guarda uma cópia numa pasta ao lado do projeto ("<nome>-backup-antes-da-integracao"). Pode rodar de novo: o que já foi aplicado é pulado.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(process.argv[2] || process.cwd());

const falhas = [];
const relatorio = [];

function ler(rel) {
  const p = path.join(raiz, rel);
  if (!fs.existsSync(p)) return null;
  const bruto = fs.readFileSync(p, 'utf8');
  return { texto: bruto.replace(/\r\n/g, '\n'), crlf: bruto.includes('\r\n') };
}

// ---------- utilitários de edição (jogam erro se o ponto de inserção não existir) ----------
function trocarUma(c, regexOuTexto, novo, descricao) {
  if (typeof regexOuTexto === 'string') {
    const i = c.indexOf(regexOuTexto);
    if (i < 0) throw new Error('não achei: ' + descricao);
    return c.slice(0, i) + novo + c.slice(i + regexOuTexto.length);
  }
  const m = regexOuTexto.exec(c);
  if (!m) throw new Error('não achei: ' + descricao);
  return c.slice(0, m.index) + (typeof novo === 'function' ? novo(m) : novo) + c.slice(m.index + m[0].length);
}
function antesDoUltimo(c, trecho, inserir, descricao) {
  const i = c.lastIndexOf(trecho);
  if (i < 0) throw new Error('não achei: ' + descricao);
  return c.slice(0, i) + inserir + c.slice(i);
}
// "require" novo logo depois do último require do topo, usando o mesmo caminho relativo do require do ../db
function comRequire(c, nomes) {
  const m = c.match(/require\('((?:\.\.\/)+)lib\/db'\)/);
  if (!m) throw new Error("não achei o require de 'lib/db' (pra descobrir o caminho)");
  const linha = "const { " + nomes + " } = require('" + m[1] + "lib/integracao');\n";
  const linhas = c.split('\n');
  let ultimo = -1;
  for (let i = 0; i < linhas.length; i++) if (/^const .* = require\(.*\);\s*$/.test(linhas[i])) ultimo = i;
  if (ultimo < 0) throw new Error('não achei nenhum require no topo');
  linhas.splice(ultimo + 1, 0, linha.trimEnd());
  return linhas.join('\n');
}
function blocoDoModelo(c, nome) {
  const ini = c.indexOf('model ' + nome + ' {');
  if (ini < 0) throw new Error('não achei o model ' + nome + ' no schema.prisma');
  const fim = c.indexOf('\n}', ini);
  return { ini, fim, texto: c.slice(ini, fim) };
}

// ---------- os ajustes (cada um devolve o texto novo, ou null se já estava aplicado) ----------
const ajustes = [];
const novo = (arquivo, descricao, fn) => ajustes.push({ arquivo, descricao, fn });

novo('prisma/schema.prisma', 'campos novos no banco (destino, idExterno, fila de avisos)', (c) => {
  let r = c;
  let mudou = false;
  const addNoModelo = (modelo, marca, linhas) => {
    const b = blocoDoModelo(r, modelo);
    if (b.texto.includes(marca)) return;
    const fimLinha = r.indexOf('\n', b.ini);
    r = r.slice(0, fimLinha + 1) + linhas + r.slice(fimLinha + 1);
    mudou = true;
  };
  addNoModelo('Assunto', 'destino', '  destino            String  @default("rh") // rh | gestor: pra onde vai o pedido\n');
  addNoModelo('Solicitacao', 'destino', '  destino          String    @default("rh") // rh | gestor\n');
  addNoModelo('Resposta', 'idExterno', '  idExterno     String?     // id da mensagem quando veio do Portal do Gestor (evita duplicar)\n  @@unique([solicitacaoId, idExterno])\n');
  if (!r.includes('model EventoPendente')) {
    r = r.replace(/\s*$/, '\n') + '\nmodel EventoPendente {\n  id               String    @id @default(cuid())\n  evento           String\n  corpo            String\n  tentativas       Int       @default(0)\n  proximaTentativa DateTime  @default(now())\n  enviadoEm        DateTime?\n  desistiu         Boolean   @default(false)\n  erro             String?\n  criadoEm         DateTime  @default(now())\n}\n';
    mudou = true;
  }
  return mudou ? r : null;
});

novo('app/api/solicitacoes/route.js', 'novo pedido: decide o destino e avisa o gestor', (c) => {
  if (c.includes('lib/integracao')) return null;
  let r = comRequire(c, 'destinoFinal, avisarGestor');
  r = trocarUma(r, /\n([ \t]*)const solicitacao = await prisma\.solicitacao\.create\(\{/, (m) =>
    "\n" + m[1] + "// Pra onde vai o pedido: o assunto manda pro gestor da loja (o Administrativo vai pro RH).\n" +
    m[1] + "const colabDestino = await prisma.colaborador.findUnique({ where: { id: sessao.id } });\n" +
    m[1] + "const destino = destinoFinal(assunto, colabDestino && colabDestino.loja);\n\n" + m[1] + "const solicitacao = await prisma.solicitacao.create({",
    'criação da solicitação (prisma.solicitacao.create)');
  r = trocarUma(r, /(colaboradorId:\s*sessao\.id,)/, (m) => m[1] + '\n      destino,', 'campo colaboradorId: sessao.id dentro do create');
  r = antesDoUltimo(r, 'return Response.json({ ok: true, id: solicitacao.id });', "if (destino === 'gestor') await avisarGestor('solicitacao.criada', solicitacao.id);\n\n  ", 'retorno final do POST');
  return r;
});

novo('app/api/solicitacoes/[id]/mensagem/route.js', 'colaborador responde: avisa o gestor', (c) => {
  if (c.includes('lib/integracao')) return null;
  let r = comRequire(c, 'avisarGestor');
  r = trocarUma(r, /\n([ \t]*)if \(texto && texto\.trim\(\)\) \{/, (m) => '\n' + m[1] + 'let respostaCriada = null;\n' + m[1] + 'if (texto && texto.trim()) {', 'bloco if (texto && texto.trim())');
  r = trocarUma(r, 'await prisma.resposta.create({', 'respostaCriada = await prisma.resposta.create({', 'prisma.resposta.create');
  r = antesDoUltimo(r, 'return Response.json({ ok: true, solicitacao: atualizada });',
    "if (atualizada.destino === 'gestor') {\n" +
    "    await avisarGestor('solicitacao.mensagem', id, {\n" +
    "      mensagem: {\n" +
    "        id: respostaCriada ? respostaCriada.id : 'a-' + Date.now(),\n" +
    "        texto: respostaCriada ? respostaCriada.texto : '',\n" +
    "        autor: 'colaborador',\n" +
    "        nomeAutor: sessao.nome,\n" +
    "        data: new Date().toISOString(),\n" +
    "        anexos: (anexos || []).map((a) => ({ nome: a.nomeArquivo, link: a.link })),\n" +
    "      },\n" +
    "    });\n" +
    "  }\n\n  ", 'retorno final do POST');
  return r;
});

novo('app/api/solicitacoes/[id]/resposta/route.js', 'RH responde: avisa o gestor', (c) => {
  if (c.includes('lib/integracao')) return null;
  let r = comRequire(c, 'avisarGestor');
  r = trocarUma(r, 'await prisma.resposta.create({', 'const respostaCriada = await prisma.resposta.create({', 'prisma.resposta.create');
  r = antesDoUltimo(r, 'return Response.json({ ok: true });',
    "if (solicitacao.destino === 'gestor') {\n" +
    "    await avisarGestor('solicitacao.mensagem', id, {\n" +
    "      mensagem: {\n" +
    "        id: respostaCriada.id,\n" +
    "        texto: respostaCriada.texto,\n" +
    "        autor: 'rh',\n" +
    "        nomeAutor: respostaCriada.nomeAutor,\n" +
    "        data: new Date().toISOString(),\n" +
    "        anexos: (anexos || []).map((a) => ({ nome: a.nomeArquivo, link: a.link })),\n" +
    "      },\n" +
    "    });\n" +
    "  }\n\n  ", 'retorno final do POST');
  return r;
});

novo('app/api/solicitacoes/[id]/encerrar/route.js', 'RH encerra: avisa o gestor', (c) => {
  if (c.includes('lib/integracao')) return null;
  let r = comRequire(c, 'avisarGestor');
  r = antesDoUltimo(r, 'return Response.json({ ok: true });', "if (solicitacao.destino === 'gestor') await avisarGestor('solicitacao.encerrada', id);\n\n  ", 'retorno final do POST');
  return r;
});

novo('app/api/solicitacoes/[id]/avaliar/route.js', 'colaborador avalia: avisa o gestor', (c) => {
  if (c.includes('lib/integracao')) return null;
  let r = comRequire(c, 'avisarGestor');
  r = trocarUma(r, 'await prisma.solicitacao.update({', 'const atualizadaAv = await prisma.solicitacao.update({', 'prisma.solicitacao.update');
  r = antesDoUltimo(r, 'return Response.json({ ok: true });',
    "if (atualizadaAv.destino === 'gestor') {\n    await avisarGestor('solicitacao.encerrada', id);\n    await avisarGestor('solicitacao.avaliada', id);\n  }\n\n  ", 'retorno final do POST');
  return r;
});

novo('app/api/assuntos/route.js', 'assunto novo: campo destino', (c) => {
  if (c.includes('destino')) return null;
  let r = trocarUma(c, 'respostaAutomatica } = await req.json();', 'respostaAutomatica, destino } = await req.json();', 'leitura dos campos do POST');
  r = trocarUma(r, 'data: { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica },', "data: { nome, prazoPadraoDias, responsavelPadrao, respostaAutomatica, destino: destino === 'gestor' ? 'gestor' : 'rh' },", 'prisma.assunto.create');
  return r;
});

novo('app/api/assuntos/[id]/route.js', 'editar assunto: campo destino', (c) => {
  if (c.includes('destino')) return null;
  let r = trocarUma(c, 'respostaAutomatica, ativo } = await req.json();', 'respostaAutomatica, ativo, destino } = await req.json();', 'leitura dos campos do PATCH');
  r = trocarUma(r, 'respostaAutomatica: respostaAutomatica || null,', "respostaAutomatica: respostaAutomatica || null,\n      ...(destino ? { destino: destino === 'gestor' ? 'gestor' : 'rh' } : {}),", 'prisma.assunto.update');
  return r;
});

novo('app/admin/assuntos/page.js', 'tela de assuntos: escolher o destino', (c) => {
  if (c.includes('destino')) return null;
  let r = trocarUma(c, "respostaAutomatica: '', ativo: true }", "respostaAutomatica: '', destino: 'rh', ativo: true }", 'valor inicial do formulário');
  r = trocarUma(r, 'respostaAutomatica: a.respostaAutomatica || \'\',', "respostaAutomatica: a.respostaAutomatica || '',\n      destino: a.destino || 'rh',", 'função editar');
  r = trocarUma(r, /(<input value=\{form\.responsavelPadrao\}[^\n]*\/>\n)/, (m) => m[1] +
    '\n          <label>Para onde vai o pedido</label>\n' +
    '          <select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}>\n' +
    '            <option value="rh">RH/DP (como sempre)</option>\n' +
    '            <option value="gestor">Gestor da loja (aparece no Portal do Gestor)</option>\n' +
    '          </select>\n', 'campo "Responsável padrão"');
  r = trocarUma(r, "responsável: {a.responsavelPadrao || '-'}", "responsável: {a.responsavelPadrao || '-'} · destino: {a.destino === 'gestor' ? 'gestor da loja' : 'RH/DP'}", 'linha da lista de assuntos');
  return r;
});

novo('app/globals.css', 'cor da bolha do gestor', (c) => {
  if (c.includes('.bolha.gestor')) return null;
  return c.replace(/\s*$/, '\n') + '\n.bolha.gestor {\n  background: #fff4e0;\n  border: 1px solid #f0d9a8;\n  border-top-left-radius: 4px;\n}\n';
});

novo('app/minhas-solicitacoes/page.js', 'colaborador pode avaliar quando o gestor encerra', (c) => {
  if (c.includes("destino === 'gestor'")) return null;
  let r = trocarUma(c, '<b>{s.assunto.nome}</b>', "<b>{s.assunto.nome}</b>{s.destino === 'gestor' && <span style={{ fontSize: 12, color: 'var(--muted)' }}> · atendimento da sua loja</span>}", 'título da solicitação');
  r = trocarUma(r, '{avaliando && (',
    "{s.status === 'encerrada' && !s.avaliacaoNota && s.destino === 'gestor' && !avaliando && (\n" +
    "        <div style={{ marginTop: 12 }}>\n" +
    '          <button type="button" className="secundario" onClick={() => setAvaliando(true)}>Avaliar o atendimento</button>\n' +
    '        </div>\n      )}\n\n      {avaliando && (', 'bloco {avaliando && (');
  return r;
});

novo('app/admin/solicitacao/[id]/page.js', 'RH vê quando o pedido é do gestor', (c) => {
  if (c.includes("destino === 'gestor'")) return null;
  return trocarUma(c, /(<p style=\{\{ fontSize: 12, color: 'var\(--muted\)' \}\}>Aberta em \{formatarDataHora\(solicitacao\.dataAbertura\)\}<\/p>\n)/, (m) => m[1] +
    "        {solicitacao.destino === 'gestor' && <p style={{ fontSize: 12, color: 'var(--muted)' }}>🧑‍💼 Pedido atendido pelo gestor da loja (Portal do Gestor). O RH acompanha e pode responder também.</p>}\n",
    'linha "Aberta em"');
});

// ---------- arquivos novos ----------
function listarNovos(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listarNovos(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]));
}
const novosArquivos = listarNovos(path.join(aqui, 'arquivos'));

// ---------- 1) conferir tudo ----------
console.log('Pasta do projeto: ' + raiz + '\n');
if (!fs.existsSync(path.join(raiz, 'prisma', 'schema.prisma')) || !fs.existsSync(path.join(raiz, 'lib', 'db.js'))) {
  console.log('✖ Essa não parece ser a pasta do Portal do Colaborador (não achei prisma/schema.prisma e lib/db.js).');
  console.log('  Confira o caminho que você passou e rode de novo. Nada foi alterado.');
  process.exit(1);
}
const planos = [];
for (const a of ajustes) {
  const arq = ler(a.arquivo);
  if (!arq) {
    falhas.push(a.arquivo + ': arquivo não existe na sua pasta (' + a.descricao + ')');
    continue;
  }
  try {
    const novoTexto = a.fn(arq.texto);
    planos.push({ ...a, arq, novoTexto });
  } catch (e) {
    falhas.push(a.arquivo + ' (' + a.descricao + '): ' + e.message);
  }
}
const criar = [];
for (const rel of novosArquivos) {
  const origem = fs.readFileSync(path.join(aqui, 'arquivos', rel), 'utf8');
  const destino = path.join(raiz, rel);
  if (fs.existsSync(destino)) {
    const atual = fs.readFileSync(destino, 'utf8').replace(/\r\n/g, '\n');
    if (atual === origem.replace(/\r\n/g, '\n')) criar.push({ rel, ja: true });
    else falhas.push(rel + ': já existe um arquivo diferente aí; não vou sobrescrever');
  } else criar.push({ rel, origem });
}

if (falhas.length) {
  console.log('✖ PAREI SEM ALTERAR NADA, porque o seu código é diferente do que eu esperava:\n');
  for (const f of falhas) console.log('  - ' + f);
  console.log('\nMe mande esta lista (ou um print) que eu ajusto o aplicador.');
  process.exit(1);
}

// ---------- 2) backup + escrever ----------
// o backup fica FORA da pasta do projeto (ao lado dela), pra não aparecer como alteração no GitHub Desktop
const pastaBackup = path.join(path.dirname(raiz), path.basename(raiz) + '-backup-antes-da-integracao');
for (const p of planos) {
  if (p.novoTexto === null) {
    relatorio.push('• já estava aplicado: ' + p.arquivo);
    continue;
  }
  const bk = path.join(pastaBackup, p.arquivo);
  if (!fs.existsSync(bk)) {
    fs.mkdirSync(path.dirname(bk), { recursive: true });
    fs.copyFileSync(path.join(raiz, p.arquivo), bk);
  }
  fs.writeFileSync(path.join(raiz, p.arquivo), p.arq.crlf ? p.novoTexto.replace(/\n/g, '\r\n') : p.novoTexto);
  relatorio.push('✔ alterado: ' + p.arquivo + '  (' + p.descricao + ')');
}
for (const n of criar) {
  if (n.ja) {
    relatorio.push('• já existia igual: ' + n.rel);
    continue;
  }
  fs.mkdirSync(path.dirname(path.join(raiz, n.rel)), { recursive: true });
  fs.writeFileSync(path.join(raiz, n.rel), n.origem);
  relatorio.push('✔ criado: ' + n.rel);
}
// agendamento diário da fila (só se ainda não existir um vercel.json)
const vj = path.join(raiz, 'vercel.json');
if (!fs.existsSync(vj)) {
  fs.writeFileSync(vj, JSON.stringify({ crons: [{ path: '/api/cron/integracao', schedule: '0 10 * * *' }] }, null, 2) + '\n');
  relatorio.push('✔ criado: vercel.json (reenvio diário dos avisos)');
} else {
  relatorio.push('• vercel.json já existe: não mexi (o reenvio diário não foi agendado; os avisos continuam sendo reenviados a cada novo aviso)');
}

console.log(relatorio.join('\n'));
console.log('\n✔ Pronto. Os arquivos antigos que foram alterados estão guardados em: ' + pastaBackup);
console.log('\nPróximos passos: 1) rodar o banco.sql no Neon  2) colocar as variáveis no Vercel  3) publicar pelo GitHub Desktop.');
