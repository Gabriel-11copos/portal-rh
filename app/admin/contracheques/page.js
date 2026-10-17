'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../components/BotaoVoltar';

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
  const pdf = await pdfjsLib.getDocument({ data: dados }).promise;
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

// Descobre de quem é o PDF, comparando o nome lido com o cadastro (elenco).
// Resultado: ok | aviso (publica, mas com ressalva) | nao (não identificado).
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
  }
  if (!escolhido.ativo) avisos.push('Colaborador inativo no cadastro: não consegue entrar no portal para ver.');
  return { ...base, status: avisos.length ? 'aviso' : 'ok', colaborador: escolhido, avisos };
}

// Um PDF pode trazer o contracheque de VÁRIAS pessoas (um por página, às vezes mais de uma página por pessoa).
// Agrupa as páginas por pessoa: uma página nova com o nome de outra pessoa começa um grupo novo;
// uma página sem nome é continuação da pessoa anterior.
function agruparPaginas(textos) {
  const grupos = [];
  textos.forEach((t, i) => {
    const linha = extrairNome(t);
    const ultimo = grupos[grupos.length - 1];
    if (linha && (!ultimo || !ultimo.linha || normalizar(ultimo.linha) !== normalizar(linha))) {
      grupos.push({ linha, indices: [i], textos: [t] });
    } else if (ultimo) {
      ultimo.indices.push(i);
      ultimo.textos.push(t);
    } else {
      grupos.push({ linha: null, indices: [i], textos: [t] });
    }
  });
  return grupos;
}

// Cria um PDF novo para cada grupo, só com as páginas dele.
async function separarGrupos(PDFLib, dados, grupos) {
  const origem = await PDFLib.PDFDocument.load(dados);
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

// Se dois PDFs do lote são da mesma pessoa, só o primeiro segue; os outros viram "repetido".
function marcarRepetidos(resultados) {
  const vistos = new Set();
  return resultados.map((r) => {
    if (!r.colaborador || (r.status !== 'ok' && r.status !== 'aviso')) return r;
    if (vistos.has(r.colaborador.id)) return { ...r, status: 'repetido', motivo: `Já há outro PDF de ${r.colaborador.nome} neste envio.` };
    vistos.add(r.colaborador.id);
    return r;
  });
}
// </leitor>

function carregarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = '/pdfjs/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
      ok(window.pdfjsLib);
    };
    s.onerror = () => falha(new Error('Não consegui carregar o leitor de PDF. Atualize a página e tente de novo.'));
    document.head.appendChild(s);
  });
}

function carregarPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise((ok, falha) => {
    const sc = document.createElement('script');
    sc.src = '/pdflib/pdf-lib.min.js';
    sc.onload = () => ok(window.PDFLib);
    sc.onerror = () => falha(new Error('Não consegui carregar o separador de PDF. Atualize a página e tente de novo.'));
    document.head.appendChild(sc);
  });
}

function Lista({ titulo, itens, render, cor, aberta }) {
  if (!itens || itens.length === 0) return null;
  return (
    <details style={{ marginTop: 10 }} open={aberta}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: cor }}>{titulo} ({itens.length})</summary>
      <ul style={{ fontSize: 13, marginTop: 6 }}>{itens.map((it, i) => <li key={i}>{render(it)}</li>)}</ul>
    </details>
  );
}

export default function Contracheques() {
  const [tipo, setTipo] = useState('Contracheque');
  const [mes, setMes] = useState('');                 // "2026-08"
  const [elenco, setElenco] = useState(null);
  const [lidos, setLidos] = useState(null);
  const [loja, setLoja] = useState('');
  const [lote, setLote] = useState(null);         // código do registro deste envio no histórico
  const [avisoLote, setAvisoLote] = useState('');
  const [notas, setNotas] = useState([]);           // avisos como "este PDF tinha 12 contracheques"
  const [lendo, setLendo] = useState('');
  const [publicando, setPublicando] = useState(null); // { feitos, total }
  const [relatorio, setRelatorio] = useState(null);   // { criados, substituidos, falhas: [...] }
  const [erro, setErro] = useState('');
  const [drive, setDrive] = useState(null);

  const competencia = mes ? `${mes.slice(5, 7)}/${mes.slice(0, 4)}` : '';
  const resultados = useMemo(() => (lidos ? marcarRepetidos(aplicarLoja(lidos, loja)) : null), [lidos, loja]);
  const lojas = useMemo(() => (elenco ? [...new Set(elenco.filter((c) => c.ativo).map((c) => c.loja))].sort((a, b) => a.localeCompare(b, 'pt-BR')) : []), [elenco]);

  useEffect(() => {
    fetch('/api/contracheques/elenco')
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok || !Array.isArray(json)) throw new Error('Não foi possível carregar os colaboradores.');
        setElenco(json.map((c) => ({ ...c, nomeNorm: normalizar(c.nome) })));
      })
      .catch((e) => setErro(e.message));
  }, []);

  async function testarDrive() {
    setDrive({ carregando: true });
    try {
      const r = await fetch('/api/contracheques/teste-drive');
      const j = await r.json();
      setDrive({ ok: !!(r.ok && j.ok), erro: j.erro || 'Falhou.', aviso: j.aviso, passos: j.passos, conta: j.conta, pasta: j.pasta });
    } catch (e) {
      setDrive({ ok: false, erro: e.message });
    }
  }

  async function lerArquivos(e) {
    const arquivos = [...e.target.files].filter((f) => /\.pdf$/i.test(f.name));
    setLidos(null); setRelatorio(null); setErro(''); setLote(null); setAvisoLote(''); setNotas([]);
    if (arquivos.length === 0) return;
    if (!elenco) { setErro('A lista de colaboradores ainda não carregou. Espere um instante e escolha os arquivos de novo.'); return; }
    try {
      const pdfjs = await carregarPdfJs();
      const lista = [];
      const novasNotas = [];
      for (let i = 0; i < arquivos.length; i++) {
        setLendo(`Lendo ${i + 1} de ${arquivos.length}...`);
        const arq = arquivos[i];
        try {
          const dados = new Uint8Array(await arq.arrayBuffer());
          const paginas = await lerTextoPaginas(pdfjs, dados);
          const grupos = agruparPaginas(paginas);
          if (grupos.length <= 1) {
            // um PDF de uma pessoa só (mesmo com várias páginas)
            const r = identificar(paginas, elenco);
            if (r.status === 'ok' && paginas.length > 2) {
              r.status = 'aviso';
              r.avisos = [`Este contracheque tem ${paginas.length} páginas. Confira se é só dessa pessoa.`];
            }
            lista.push({ ...r, arquivo: arq, nome: arq.name, amostra: paginas[0] ? paginas[0].split('\n').slice(0, 12).join('\n') : '' });
          } else {
            // um PDF com várias pessoas: separa em um PDF para cada uma
            setLendo(`Separando ${arq.name} (${grupos.length} pessoas)...`);
            const PDFLib = await carregarPdfLib();
            const partes = await separarGrupos(PDFLib, dados, grupos);
            novasNotas.push(`📑 ${arq.name} tinha ${paginas.length} páginas e ${grupos.length} contracheques; separei um PDF para cada pessoa.`);
            grupos.forEach((g, k) => {
              const r = identificar(g.textos, elenco);
              if (r.status === 'ok' && g.indices.length > 2) {
                r.status = 'aviso';
                r.avisos = [`Este contracheque tem ${g.indices.length} páginas. Confira se é só dessa pessoa.`];
              }
              const rotulo = g.indices.length === 1 ? `pág. ${g.indices[0] + 1}` : `págs. ${g.indices[0] + 1} a ${g.indices[g.indices.length - 1] + 1}`;
              const nomeParte = `${r.nomeLido || 'documento'} (${rotulo}).pdf`;
              lista.push({ ...r, arquivo: new File([partes[k]], nomeParte, { type: 'application/pdf' }), nome: `${arq.name} (${rotulo})`, amostra: g.textos[0].split('\n').slice(0, 12).join('\n') });
            });
          }
        } catch {
          lista.push({ status: 'nao', motivo: 'Não consegui ler ou separar este PDF (pode estar protegido ou corrompido).', arquivo: arq, nome: arq.name, amostra: '' });
        }
      }
      setNotas(novasNotas);
      setLidos(lista);
    } catch (err) {
      setErro(err.message || 'Não foi possível ler os arquivos.');
    } finally {
      setLendo('');
    }
  }

  async function enviar(item, loteId) {
    const form = new FormData();
    form.set('arquivo', item.arquivo);
    form.set('colaboradorId', item.colaborador.id);
    form.set('tipo', tipo);
    form.set('competencia', competencia);
    // loja da pasta no Drive: a escolhida; em "Todas as lojas", a empresa do próprio PDF (ou a do cadastro)
    form.set('lojaPasta', loja && loja !== TODAS ? loja : (item.empresaLida || item.colaborador.loja));
    if (loteId) form.set('loteId', loteId);
    try {
      const r = await fetch('/api/contracheques/publicar', { method: 'POST', body: form });
      const j = await r.json();
      return r.ok ? { item, ok: true, acao: j.acao } : { item, ok: false, erro: j.erro || 'Falhou.' };
    } catch (e) {
      return { item, ok: false, erro: e.message || 'Falhou.' };
    }
  }

  async function publicar(itens) {
    if (!window.confirm(`Publicar ${itens.length} documento(s) de "${tipo}" referentes a ${competencia} (${loja})? Cada colaborador passa a ver o dele em Documentos.`)) return;
    setRelatorio(null);
    setPublicando({ feitos: 0, total: itens.length });
    // registra este envio no histórico (só na primeira vez; "tentar de novo" soma no mesmo registro)
    let loteId = lote;
    if (!loteId) {
      try {
        const r = await fetch('/api/contracheques/lotes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, competencia, loja, total: itens.length }),
        });
        const j = await r.json();
        if (r.ok && j.id) { loteId = j.id; setLote(j.id); setAvisoLote(''); }
        else setAvisoLote('Os documentos serão enviados, mas não foi possível registrar este envio no histórico.');
      } catch {
        setAvisoLote('Os documentos serão enviados, mas não foi possível registrar este envio no histórico.');
      }
    }
    const fila = [...itens];
    const feitos = [];
    async function trabalhador() {
      while (fila.length > 0) {
        const item = fila.shift();
        feitos.push(await enviar(item, loteId));
        setPublicando({ feitos: feitos.length, total: itens.length });
      }
    }
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
    setPublicando(null);
    setRelatorio({
      criados: feitos.filter((f) => f.ok && f.acao === 'criado').length,
      substituidos: feitos.filter((f) => f.ok && f.acao === 'substituido').length,
      falhas: feitos.filter((f) => !f.ok),
    });
  }

  const prontos = resultados ? resultados.filter((r) => r.status === 'ok' || r.status === 'aviso') : [];
  const avisos = resultados ? resultados.filter((r) => r.status === 'aviso') : [];
  const naoIdentificados = resultados ? resultados.filter((r) => r.status === 'nao') : [];
  const fora = resultados ? resultados.filter((r) => r.status === 'fora') : [];
  const repetidos = resultados ? resultados.filter((r) => r.status === 'repetido') : [];
  const podePublicar = prontos.length > 0 && !!competencia && !!loja && !!tipo.trim() && !publicando;

  return (
    <div>
      <BotaoVoltar />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Distribuir contracheques</h2>
        <Link href="/admin/contracheques/historico" style={{ fontSize: 13, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>📋 Histórico e quem falta enviar</Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Escolha os PDFs (um por colaborador, com qualquer nome de arquivo). O portal lê o nome dentro de cada PDF,
        mostra quem é quem para você conferir e, só depois que você confirmar, guarda cada um na pasta do colaborador.
        Os arquivos ficam privados: só o próprio colaborador e o RH abrem.
      </p>
      {erro && <div className="erro">{erro}</div>}

      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="secundario" onClick={testarDrive} disabled={drive && drive.carregando}>Testar conexão com o Drive</button>
          {drive && drive.carregando && <span style={{ fontSize: 13, color: 'var(--muted)' }}>Testando...</span>}
          {drive && drive.ok && <span style={{ fontSize: 13, color: 'var(--success)' }}>✓ Conexão funcionando.</span>}
          {drive && drive.ok === false && <span style={{ fontSize: 13, color: 'var(--danger)' }}>✗ {drive.erro}</span>}
        </div>
        {drive && drive.ok && drive.aviso && <p style={{ fontSize: 13, color: 'var(--warning)', margin: '8px 0 0' }}>⚠ {drive.aviso}</p>}
        {drive && !drive.carregando && drive.passos && drive.passos.length > 0 && (drive.ok === false || drive.passos.some((p) => !p.ok)) && (
          <details open style={{ marginTop: 8, fontSize: 12 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Detalhes do teste (para mostrar ao suporte)</summary>
            <div style={{ marginTop: 4 }}>Conta do portal: <b>{drive.conta || 'não identificada'}</b></div>
            <div>Pasta principal (código): <b>{drive.pasta || 'não configurada'}</b></div>
            <ul style={{ margin: '6px 0 0' }}>
              {drive.passos.map((p, i) => <li key={i}>{p.ok ? '✓' : '✗'} {p.nome}{p.detalhe ? `: ${p.detalhe}` : ''}</li>)}
            </ul>
          </details>
        )}
      </div>

      <div className="card">
        <label>Tipo do documento</label>
        <input list="tipos-doc" value={tipo} maxLength={40} onChange={(e) => { setTipo(e.target.value); setRelatorio(null); setLote(null); }} />
        <datalist id="tipos-doc">
          <option value="Contracheque" /><option value="Contracheque de 13º salário" /><option value="Adiantamento" /><option value="Férias" /><option value="Informe de rendimentos" />
        </datalist>
        <label>Competência (mês a que o documento se refere)</label>
        <input type="month" value={mes} onChange={(e) => { setMes(e.target.value); setRelatorio(null); setLote(null); }} style={{ maxWidth: 220 }} />
        <label>Loja deste envio</label>
        <select value={loja} onChange={(e) => { setLoja(e.target.value); setRelatorio(null); setLote(null); }} style={{ maxWidth: 320 }}>
          <option value="">Escolha...</option>
          <option value={TODAS}>{TODAS} (mistura de lojas)</option>
          {lojas.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 8px' }}>
          Escolhendo uma loja, os PDFs de outra loja ficam de fora (evita misturar). A loja fica registrada no histórico.
        </p>
        <label>PDFs (pode escolher vários de uma vez)</label>
        <input type="file" accept=".pdf,application/pdf" multiple onChange={lerArquivos} disabled={!elenco} />
        {!elenco && !erro && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Carregando a lista de colaboradores...</p>}
        {lendo && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{lendo}</p>}
      </div>

      {resultados && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Confira antes de publicar</h3>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '6px 0 4px' }}>
            <div><b style={{ fontSize: 22, color: 'var(--success)' }}>{prontos.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>prontos para publicar</div></div>
            <div><b style={{ fontSize: 22, color: 'var(--warning)' }}>{avisos.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>com aviso</div></div>
            <div><b style={{ fontSize: 22, color: 'var(--danger)' }}>{naoIdentificados.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>não identificados</div></div>
            {fora.length > 0 && <div><b style={{ fontSize: 22 }}>{fora.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>de outra loja</div></div>}
            {repetidos.length > 0 && <div><b style={{ fontSize: 22 }}>{repetidos.length}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>repetidos</div></div>}
          </div>
          {notas.map((n, i) => <p key={i} style={{ fontSize: 13, margin: '4px 0' }}>{n}</p>)}
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nada foi publicado ainda. Os não identificados, os de outra loja e os repetidos ficam de fora.</p>

          <Lista titulo="Com aviso (serão publicados, confira)" itens={avisos} cor="var(--warning)" aberta
            render={(r) => <span><b>{r.nome}</b> → {r.colaborador.nome}: {r.avisos.join(' ')}</span>} />
          <Lista titulo="Não identificados (ficam de fora)" itens={naoIdentificados} cor="var(--danger)" aberta
            render={(r) => (
              <span>
                <b>{r.nome}</b>: {r.motivo}
                {r.amostra && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>Ver o começo do texto lido</summary>
                    <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: 'var(--pastel-bg)', padding: 8, borderRadius: 8 }}>{r.amostra}</pre>
                  </details>
                )}
              </span>
            )} />
          <Lista titulo={`De outra loja, não de ${loja} (ficam de fora)`} itens={fora} cor="var(--muted)" aberta
            render={(r) => <span><b>{r.nome}</b> → {r.colaborador.nome}: {r.motivo}</span>} />
          <Lista titulo="Repetidos no envio (ficam de fora)" itens={repetidos} cor="var(--muted)" render={(r) => <span><b>{r.nome}</b>: {r.motivo}</span>} />
          <Lista titulo="Prontos para publicar" itens={prontos} render={(r) => <span>{r.nome} → <b>{r.colaborador.nome}</b> ({r.colaborador.loja})</span>} />

          <button type="button" style={{ marginTop: 14 }} disabled={!podePublicar} onClick={() => publicar(prontos)}>
            {publicando ? `Publicando ${publicando.feitos} de ${publicando.total}...` : `Publicar ${prontos.length} documento(s)`}
          </button>
          {prontos.length > 0 && (!competencia || !loja) && (
            <p style={{ fontSize: 13, color: 'var(--warning)' }}>Escolha {!competencia && !loja ? 'a competência (o mês) e a loja' : !competencia ? 'a competência (o mês)' : 'a loja'} para poder publicar.</p>
          )}
        </div>
      )}

      {relatorio && (
        <div className="card">
          <h3 style={{ marginTop: 0, color: relatorio.falhas.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
            {relatorio.falhas.length === 0 ? '✓ Publicação concluída' : 'Publicação concluída, com falhas'}
          </h3>
          <p style={{ margin: 0 }}>
            <b>{relatorio.criados}</b> publicado(s){relatorio.substituidos > 0 && <span>, <b>{relatorio.substituidos}</b> substituído(s) (já existia este tipo e competência)</span>}.
          </p>
          {lote && <p style={{ fontSize: 13, margin: '6px 0 0' }}>📋 Envio registrado no histórico ({loja}, {competencia}). <Link href="/admin/contracheques/historico">Ver quem já recebeu e quem falta</Link></p>}
          {avisoLote && <p style={{ fontSize: 13, color: 'var(--warning)', margin: '6px 0 0' }}>{avisoLote}</p>}
          <Lista titulo="Falharam (nada foi registrado para eles)" itens={relatorio.falhas} cor="var(--danger)" aberta
            render={(f) => <span><b>{f.item.nome}</b> → {f.item.colaborador.nome}: {f.erro}</span>} />
          {relatorio.falhas.length > 0 && (
            <button type="button" style={{ marginTop: 10 }} onClick={() => publicar(relatorio.falhas.map((f) => f.item))}>
              Tentar de novo os {relatorio.falhas.length} que falharam
            </button>
          )}
        </div>
      )}
    </div>
  );
}
