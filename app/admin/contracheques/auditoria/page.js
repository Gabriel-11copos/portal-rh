'use client';
import { useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../../components/BotaoVoltar';

// <leitor>
function normalizar(t) {
  return String(t == null ? '' : t)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

// Razão social que aparece no contracheque -> nome da loja no cadastro
const EMPRESAS = {
  'BREWTECO TERRACO BAR E RESTAURANTE LTDA': 'Brewteco Terraço',
  'BREWTECO GAVEA BAR E RESTAURANTE LTDA': 'Brewteco Gávea',
  'BREWTECO ROSAS BAR E RESTAURANTE LTDA': 'Brewteco Rosas',
  'BREWTECO TIJUCA BAR E RESTAURANTE LTDA': 'Brewteco Tijuca',
  'ONZE COPOS PARTICIPACOES S.A.': 'Onze Copos (Administrativo)',
  'BREWTECO LARANJEIRAS BAR E RESTAURANTE LTDA': 'Brewteco Laranjeiras',
  'BAR MARISQUEIRA DO LEBLON LTDA': 'Marisqueira do Leblon',
  'CERVEJARIA BREWTECO LTDA': 'Cervejaria Brewteco (Fábrica)',
  'BREWTECO MORRO DA URCA BAR E RESTAURANTE LTDA': 'Brewteco Morro da Urca',
  'ONZE COPOS EVENTOS LTDA': 'Onze Copos Eventos',
};

// Lê o texto de cada página do PDF, linha por linha (de cima para baixo, da esquerda para a direita).
async function lerTextoPaginas(pdfjsLib, dados) {
  // O leitor de PDF "consome" o arquivo que recebe (no navegador ele passa a memória para um processo à parte e o
  // original fica vazio). Por isso ele recebe uma CÓPIA: o original precisa continuar inteiro para separar depois.
  const pdf = await pdfjsLib.getDocument({ data: dados.slice() }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const conteudo = await page.getTextContent();
    const itens = conteudo.items
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str.trim() }));
    itens.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas = [];
    let atual = null;
    for (const it of itens) {
      if (!atual || Math.abs(atual.y - it.y) > 2) { atual = { y: it.y, itens: [] }; linhas.push(atual); }
      atual.itens.push(it);
    }
    paginas.push(linhas.map((l) => l.itens.sort((a, b) => a.x - b.x).map((it) => it.s).join(' ')).join('\n'));
  }
  if (pdf.destroy) pdf.destroy();
  return paginas;
}

// O nome do colaborador está numa linha com um código de 6 dígitos, que pode vir ANTES do nome
// ("000005 ANA BEATRIZ CLEMENTE Coordenador (a) de MKT") ou DEPOIS ("ANA LIMA 000123").
// Devolve a linha sem o código (pode trazer o cargo junto: o cruzamento com o cadastro resolve).
function extrairNome(texto) {
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !/Demonstrativo de Pagamento/i.test(l));
  for (const linha of linhas) {
    const m = linha.match(/^\d{6}\s+([A-ZÀ-ÖØ-Ý].*)$/);
    if (m) return m[1].trim();
  }
  for (const linha of linhas) {
    const m = linha.match(/^(.+?)\s+\d{6}$/);
    if (m) return m[1].trim();
  }
  return null;
}

// As palavras em MAIÚSCULAS do começo da linha (o nome); o cargo costuma vir depois, em minúsculas.
function nomeProvavel(texto) {
  const nome = [];
  for (const t of String(texto || '').trim().split(/\s+/)) {
    if (/^[A-ZÀ-ÖØ-Ý'’.\-]+$/.test(t)) nome.push(t); else break;
  }
  return nome.length ? nome.join(' ') : String(texto || '').trim();
}

// A empresa é a linha que contém uma das razões sociais conhecidas.
function extrairEmpresa(texto) {
  const linhas = texto.split('\n').map(normalizar).filter(Boolean);
  const chaves = Object.keys(EMPRESAS).sort((a, b) => b.length - a.length);
  for (const linha of linhas) {
    for (const chave of chaves) {
      if (linha.includes(chave)) return EMPRESAS[chave];
    }
  }
  return null;
}

// Quantas páginas, no máximo, um contracheque de UMA pessoa pode ter. Acima disso o arquivo não é publicado
// (provavelmente são várias pessoas juntas).
const MAX_PAGINAS_PESSOA = 3;

// Descobre de quem é o PDF, comparando o nome lido com o cadastro (elenco).
// Resultado: ok | aviso (publica, com ressalva sem risco) | conferir (só publica se o RH confirmar) | nao (não identificado).
function identificar(paginas, elenco) {
  let linhaNome = null;
  let empresaLida = null;
  for (const texto of paginas) {
    if (!linhaNome) linhaNome = extrairNome(texto);
    if (!empresaLida) empresaLida = extrairEmpresa(texto);
  }
  const nomeLido = linhaNome ? nomeProvavel(linhaNome) : null;
  const base = { nomeLido, empresaLida };
  if (!linhaNome) return { ...base, status: 'nao', motivo: 'Não encontrei o nome do colaborador dentro do PDF.' };

  // Proteção: um arquivo é de UMA pessoa só. Se tem páginas de pessoas ou empresas diferentes, ou páginas demais, não vai.
  const nomesNoArquivo = [...new Set(paginas.map(extrairNome).filter(Boolean).map(normalizar))];
  if (nomesNoArquivo.length > 1) return { ...base, status: 'nao', motivo: `O arquivo tem páginas de ${nomesNoArquivo.length} pessoas diferentes. Separe por pessoa antes de enviar.` };
  const empresasNoArquivo = [...new Set(paginas.map(extrairEmpresa).filter(Boolean))];
  if (empresasNoArquivo.length > 1) return { ...base, status: 'nao', motivo: `O arquivo mistura contracheques de mais de uma empresa (${empresasNoArquivo.join(', ')}).` };
  if (paginas.length > MAX_PAGINAS_PESSOA) return { ...base, status: 'nao', motivo: `O arquivo tem ${paginas.length} páginas, mais do que o normal para uma pessoa. Confira se não são várias pessoas juntas.` };

  const alvo = normalizar(linhaNome);
  let candidatos = elenco.filter((c) => c.nomeNorm && (alvo === c.nomeNorm || alvo.startsWith(`${c.nomeNorm} `)));
  if (candidatos.length === 0) return { ...base, status: 'nao', motivo: `Ninguém no cadastro com o nome "${nomeLido}".` };
  const maior = Math.max(...candidatos.map((c) => c.nomeNorm.length));
  candidatos = candidatos.filter((c) => c.nomeNorm.length === maior);

  // Se o PDF tem mais palavras em MAIÚSCULAS depois do nome do cadastro, pode ser um sobrenome que o
  // cadastro não tem (outra pessoa, ou nome incompleto). Não arrisca: deixa de fora para conferir.
  const palavras = linhaNome.trim().split(/\s+/);
  const sobra = palavras.slice(candidatos[0].nomeNorm.split(' ').length);
  if (sobra.length > 0 && /^[A-ZÀ-ÖØ-Ý'’.\-]+$/.test(sobra[0])) {
    return { ...base, status: 'nao', motivo: `O nome no PDF ("${nomeLido}") é mais longo que o do cadastro ("${candidatos[0].nome}"). Confira o cadastro.` };
  }

  const daEmpresa = empresaLida ? candidatos.filter((c) => c.loja === empresaLida) : [];
  const avisos = [];
  let precisaConferir = false;
  let escolhido;
  if (daEmpresa.length === 1) {
    escolhido = daEmpresa[0];
  } else if (daEmpresa.length > 1 || candidatos.length > 1) {
    return { ...base, status: 'nao', motivo: `Mais de um colaborador com o nome "${nomeLido}". Envie este arquivo pelo fluxo manual.` };
  } else {
    escolhido = candidatos[0];
    avisos.push(empresaLida
      ? `A empresa do contracheque (${empresaLida}) é diferente da do cadastro (${escolhido.loja}).`
      : 'Não reconheci a empresa no PDF; conferi só pelo nome.');
    precisaConferir = true;
  }
  if (paginas.length > 2) {
    avisos.push(`Este contracheque tem ${paginas.length} páginas. Confira se é só dessa pessoa.`);
    precisaConferir = true;
  }
  if (!escolhido.ativo) avisos.push('Colaborador inativo no cadastro: não consegue entrar no portal para ver.');
  const status = precisaConferir ? 'conferir' : avisos.length ? 'aviso' : 'ok';
  return { ...base, status, colaborador: escolhido, avisos };
}

// Um PDF pode trazer o contracheque de VÁRIAS pessoas (um por página, às vezes mais de uma página por pessoa).
// Agrupa as páginas por pessoa: páginas seguidas com o MESMO nome são da mesma pessoa; outro nome começa um grupo novo.
// Uma página em que não deu para ler o nome NUNCA é grudada na pessoa anterior (foi assim que contracheques de outras
// pessoas foram parar no arquivo de uma só): ela fica separada, como "não identificada", para o RH conferir.
function agruparPaginas(textos) {
  const grupos = [];
  textos.forEach((t, i) => {
    const linha = extrairNome(t);
    const ultimo = grupos[grupos.length - 1];
    if (linha && ultimo && ultimo.linha && normalizar(ultimo.linha) === normalizar(linha)) {
      ultimo.indices.push(i);
      ultimo.textos.push(t);
    } else {
      grupos.push({ linha: linha || null, indices: [i], textos: [t] });
    }
  });
  return grupos;
}

// Confere o arquivo JÁ SEPARADO (o que de fato será enviado): tem o número de páginas esperado e todas são da pessoa esperada.
// Devolve o motivo do problema, ou null se está certo.
function conferirParte(textosDaParte, grupo) {
  if (textosDaParte.length !== grupo.indices.length) {
    return `O arquivo separado tem ${textosDaParte.length} página(s), mas eram ${grupo.indices.length}.`;
  }
  const esperado = grupo.linha ? normalizar(grupo.linha) : null;
  for (const t of textosDaParte) {
    const nome = extrairNome(t);
    if (!nome) return 'Uma página do arquivo separado não tem nome legível.';
    if (esperado && normalizar(nome) !== esperado) return 'Uma página do arquivo separado é de outra pessoa.';
  }
  return null;
}

// Cria um PDF novo para cada grupo, só com as páginas dele.
async function separarGrupos(PDFLib, dados, grupos) {
  // PDFs de folha costumam vir protegidos contra edição (senha de abertura vazia): abre assim mesmo
  const origem = await PDFLib.PDFDocument.load(dados, { password: '' });
  const partes = [];
  for (const g of grupos) {
    const doc = await PDFLib.PDFDocument.create();
    const paginas = await doc.copyPages(origem, g.indices);
    paginas.forEach((p) => doc.addPage(p));
    partes.push(await doc.save());
  }
  return partes;
}

const TODAS = 'Todas as lojas';

// Com uma loja escolhida, PDF de outra loja fica de fora (evita misturar envios).
// A loja do PDF é a da empresa que aparece nele; se não deu para ler, vale a do cadastro.
function aplicarLoja(lidos, loja) {
  if (!loja || loja === TODAS) return lidos;
  return lidos.map((r) => {
    if (!r.colaborador) return r;
    const daqui = r.empresaLida || r.colaborador.loja;
    return daqui === loja ? r : { ...r, status: 'fora', motivo: `É de ${daqui}, não de ${loja}.` };
  });
}

// Diz por que um PDF não pôde ser lido ou separado, em palavras simples (com o detalhe técnico no fim).
function explicarFalhaPdf(err, etapa) {
  const msg = String((err && err.message) || err || '').replace(/\s+/g, ' ').trim();
  if (/carregar o separador/i.test(msg)) return msg;
  if ((err && err.name === 'PasswordException') || /password|senha/i.test(msg)) return 'O PDF exige senha para abrir. Tire a senha e escolha o arquivo de novo.';
  if (etapa === 'separar' && /encrypt|criptograf/i.test(msg)) return 'O PDF tem uma proteção que impede separar por pessoa. Tire a proteção e escolha de novo.';
  const base = etapa === 'separar' ? 'Não consegui separar este PDF por pessoa' : 'Não consegui ler este PDF';
  return `${base} (${msg.slice(0, 140) || 'erro desconhecido'}).`;
}

// Se dois PDFs do lote são da mesma pessoa, só o primeiro segue; os outros viram "repetido".
function marcarRepetidos(resultados) {
  const vistos = new Set();
  return resultados.map((r) => {
    if (!r.colaborador || (r.status !== 'ok' && r.status !== 'aviso' && r.status !== 'conferir')) return r;
    if (vistos.has(r.colaborador.id)) return { ...r, status: 'repetido', motivo: `Já há outro PDF de ${r.colaborador.nome} neste envio.` };
    vistos.add(r.colaborador.id);
    return r;
  });
}
// </leitor>

// <auditoria>
// Regras para dizer se o arquivo guardado é mesmo do dono. As regras de LEITURA do PDF acima são as mesmas do envio.
function situacaoDoNome(linhaNome, alvo) {
  const base = normalizar(nomeProvavel(linhaNome));
  if (base === alvo) return 'igual';
  if (base.startsWith(`${alvo} `)) return 'a-mais';     // o nome do arquivo tem palavras a mais (sobrenome ou cargo em maiúsculas)
  return 'diferente';
}

// Devolve { paginas, nomes, empresas, motivos, veredito: 'ok' | 'conferir' | 'suspeito' }
function analisarDocumento(textos, colaborador) {
  const alvo = normalizar(colaborador.nome);
  const linhas = textos.map(extrairNome).filter(Boolean);
  const nomes = [...new Set(linhas.map((l) => normalizar(nomeProvavel(l))))];
  const empresas = [...new Set(textos.map(extrairEmpresa).filter(Boolean))];
  const motivos = [];
  let grave = false;
  if (linhas.length === 0) motivos.push('Não consegui ler o nome dentro do arquivo.');
  if (nomes.length > 1) { motivos.push(`O arquivo tem páginas de ${nomes.length} pessoas diferentes.`); grave = true; }
  const situacoes = linhas.map((l) => situacaoDoNome(l, alvo));
  if (situacoes.includes('diferente')) { motivos.push('O nome que está no arquivo não é o do dono do documento.'); grave = true; }
  else if (situacoes.includes('a-mais')) motivos.push('O nome no arquivo tem palavras a mais que o do cadastro. Confira se é a mesma pessoa.');
  if (empresas.length > 1) { motivos.push(`O arquivo mistura mais de uma empresa (${empresas.join(', ')}).`); grave = true; }
  if (textos.length > MAX_PAGINAS_PESSOA) { motivos.push(`O arquivo tem ${textos.length} páginas, mais do que o normal para uma pessoa.`); grave = true; }
  else if (textos.length > 2) motivos.push(`O arquivo tem ${textos.length} páginas. Confira se é só dessa pessoa.`);
  if (empresas.length === 1 && colaborador.loja && empresas[0] !== colaborador.loja) motivos.push(`A empresa do arquivo (${empresas[0]}) é diferente da loja do cadastro (${colaborador.loja}).`);
  return { paginas: textos.length, nomes, empresas, motivos, veredito: grave ? 'suspeito' : motivos.length ? 'conferir' : 'ok' };
}

function carregarPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = '/pdfjs/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'; resolve(window.pdfjsLib); };
    s.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF. Atualize a página e tente de novo.'));
    document.body.appendChild(s);
  });
}
// </auditoria>

const ROTULOS = { suspeito: 'Suspeito', conferir: 'Conferir', ok: 'Em ordem', erro: 'Não consegui abrir', removido: 'Removido' };
const CORES = { suspeito: 'var(--danger)', conferir: 'var(--warning)', ok: 'var(--success)', erro: 'var(--muted)', removido: 'var(--muted)' };

export default function AuditoriaContracheques() {
  const [tipo, setTipo] = useState('Contracheque');
  const [mes, setMes] = useState('');
  const [itens, setItens] = useState(null);       // [{ ...documento, resultado }]
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const competencia = mes ? `${mes.slice(5, 7)}/${mes.slice(0, 4)}` : '';

  async function verificar() {
    setErro(''); setAviso(''); setItens(null);
    try {
      setProgresso('Buscando os documentos...');
      const r = await fetch(`/api/contracheques/auditoria?tipo=${encodeURIComponent(tipo)}&competencia=${encodeURIComponent(competencia)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível buscar os documentos.');
      const pdfjs = await carregarPdfJs();
      const lista = j.itens.map((d) => ({ ...d, resultado: null }));
      setItens([...lista]);
      let proximo = 0; let feitos = 0;
      async function trabalhador() {
        while (proximo < lista.length) {
          const i = proximo++;
          const d = lista[i];
          try {
            if (!d.arquivoUrl) throw new Error('SEM_ARQUIVO');
            const res = await fetch(d.arquivoUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const dados = new Uint8Array(await res.arrayBuffer());
            d.resultado = analisarDocumento(await lerTextoPaginas(pdfjs, dados), d.colaborador);
          } catch (e) {
            d.resultado = { veredito: 'erro', paginas: 0, nomes: [], empresas: [], motivos: [e && e.message === 'SEM_ARQUIVO' ? 'Este documento não tem um arquivo que o portal consiga abrir (endereço antigo). Você pode excluí-lo e enviar de novo.' : `Não foi possível abrir o arquivo (${String(e && e.message ? e.message : e).slice(0, 80)}).`] };
          }
          feitos += 1;
          setProgresso(`Verificando ${feitos} de ${lista.length}...`);
          setItens([...lista]);
        }
      }
      await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
      setProgresso('');
    } catch (e) {
      setProgresso('');
      setErro(e.message || 'Não foi possível verificar.');
    }
  }

  async function remover(d) {
    const r = await fetch('/api/contracheques/remover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentoId: d.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, mensagem: `Não foi possível remover o de ${d.colaborador.nome}: ${j.erro || 'erro desconhecido'}` };
    d.resultado = { ...d.resultado, veredito: 'removido', motivos: [] };
    d.arquivoApagado = j.arquivoApagado;
    setItens([...itens]);
    return { ok: true };
  }

  async function removerUm(d) {
    if (!window.confirm(`Remover o documento de ${d.colaborador.nome}? Ele deixa de ver este arquivo e o arquivo é apagado do Drive. Depois, envie o contracheque certo.`)) return;
    setAviso('');
    const r = await remover(d);
    setAviso(r.ok ? `Removido: ${d.colaborador.nome}. Agora ele aparece em "quem falta" no histórico.` : r.mensagem);
  }

  async function removerSuspeitos() {
    const alvo = itens.filter((d) => d.resultado && d.resultado.veredito === 'suspeito');
    if (!window.confirm(`Remover ${alvo.length} documento(s) suspeito(s)? Eles deixam de aparecer para os colaboradores e os arquivos são apagados do Drive.`)) return;
    setAviso('');
    let feitos = 0;
    const falhas = [];
    for (const d of alvo) { const r = await remover(d); if (r.ok) feitos += 1; else falhas.push(r.mensagem); }
    setAviso(`${feitos} de ${alvo.length} removido(s). Quem foi removido volta a aparecer em "quem falta" no histórico.${falhas.length ? ` ${falhas.join(' ')}` : ''}`);
  }

  const por = (v) => (itens || []).filter((d) => d.resultado && d.resultado.veredito === v);
  const suspeitos = por('suspeito'); const conferir = por('conferir'); const oks = por('ok'); const falhas = por('erro');
  const verificando = !!progresso;

  const linha = (d) => (
    <div key={d.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>{d.colaborador.nome}</b>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.colaborador.loja}</span>
        <span style={{ fontSize: 12, color: CORES[d.resultado.veredito] }}>{ROTULOS[d.resultado.veredito]}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.resultado.paginas} pág. · {d.visto ? 'o colaborador JÁ abriu' : 'ainda não aberto pelo colaborador'}</span>
        {d.origem === 'drive-antigo' && <span style={{ fontSize: 12, color: 'var(--danger)' }}>envio antigo (link aberto no Drive)</span>}
        {d.resultado.veredito !== 'removido' && d.resultado.veredito !== 'ok' && <button type="button" className="secundario" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => removerUm(d)}>Remover este envio</button>}
      </div>
      {d.resultado.motivos.map((m) => <div key={m} style={{ fontSize: 13 }}>• {m}</div>)}
      {d.resultado.nomes.length > 1 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nomes encontrados no arquivo: {d.resultado.nomes.join('; ')}</div>}
    </div>
  );

  return (
    <div>
      <BotaoVoltar />
      <h2>Auditar envios de documentos</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Abre cada arquivo já enviado e confere se o nome dentro dele é mesmo o do dono. Mostra se o colaborador já abriu, e deixa recolher o que foi enviado por engano.
        Depois de remover, envie o contracheque certo em <Link href="/admin/contracheques">Distribuir contracheques</Link>.
      </p>
      {erro && <div className="erro">{erro}</div>}
      <div className="card">
        <label>Tipo do documento</label>
        <input value={tipo} maxLength={40} onChange={(e) => setTipo(e.target.value)} />
        <label>Competência</label>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ maxWidth: 220 }} />
        <button type="button" onClick={verificar} disabled={!mes || !tipo.trim() || verificando}>{verificando ? progresso : 'Verificar envios'}</button>
      </div>

      {itens && (
        <div className="card">
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 6 }}>
            <div><b style={{ fontSize: 22, color: 'var(--danger)' }}>{suspeitos.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>suspeitos</div></div>
            <div><b style={{ fontSize: 22, color: 'var(--warning)' }}>{conferir.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>para conferir</div></div>
            <div><b style={{ fontSize: 22, color: 'var(--success)' }}>{oks.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>em ordem</div></div>
            {falhas.length > 0 && <div><b style={{ fontSize: 22 }}>{falhas.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>não consegui abrir</div></div>}
          </div>
          <p style={{ fontSize: 13, margin: '4px 0' }}>
            {itens.length} documento(s) encontrado(s): {Object.entries(itens.reduce((m, d) => ({ ...m, [d.colaborador.loja]: (m[d.colaborador.loja] || 0) + 1 }), {})).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([l, n]) => `${l} (${n})`).join(' · ')}.
          </p>
          {aviso && <p style={{ fontSize: 13 }}>{aviso}</p>}
          {suspeitos.length > 0 && !verificando && <button type="button" onClick={removerSuspeitos}>Remover os {suspeitos.length} suspeitos</button>}
          {suspeitos.length > 0 && <h3 style={{ marginBottom: 0, color: 'var(--danger)' }}>Suspeitos</h3>}
          {suspeitos.map(linha)}
          {conferir.length > 0 && <h3 style={{ marginBottom: 0, color: 'var(--warning)' }}>Para conferir</h3>}
          {conferir.map(linha)}
          {falhas.length > 0 && <h3 style={{ marginBottom: 0 }}>Não consegui abrir</h3>}
          {falhas.map(linha)}
          {oks.length > 0 && <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontSize: 13 }}>Ver os {oks.length} em ordem</summary>{oks.map(linha)}</details>}
          {itens.filter((d) => d.resultado && d.resultado.veredito === 'removido').length > 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{itens.filter((d) => d.resultado && d.resultado.veredito === 'removido').length} removido(s) nesta sessão.</p>}
          {itens.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum documento deste tipo e competência.</p>}
        </div>
      )}
    </div>
  );
}
