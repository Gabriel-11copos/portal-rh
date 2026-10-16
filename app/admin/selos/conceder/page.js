'use client';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import BotaoVoltar from '../../../components/BotaoVoltar';

// <planilha>
// Transforma uma planilha em texto, para o servidor achar os CPFs. Números de 10 dígitos
// (CPF que perdeu o zero à esquerda no Excel) voltam a ter 11.
function planilhaParaTexto(XLSXlib, dados) {
  const wb = XLSXlib.read(dados, { type: 'array' });
  const linhas = [];
  for (const nome of wb.SheetNames) {
    const matriz = XLSXlib.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: '' });
    for (const linha of matriz) {
      linhas.push(linha.map((v) => {
        if (typeof v === 'number' && Number.isFinite(v)) {
          const s = String(Math.round(v));
          return Number.isInteger(v) && (s.length === 10 || s.length === 11) ? s.padStart(11, '0') : String(v);
        }
        return String(v == null ? '' : v);
      }).join('\t'));
    }
  }
  return linhas.join('\n');
}
// </planilha>

function hojeLocal() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

function Lista({ titulo, itens, render, cor }) {
  if (!itens || itens.length === 0) return null;
  return (
    <details style={{ marginTop: 8 }} open={itens.length <= 8}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: cor }}>{titulo} ({itens.length})</summary>
      <ul style={{ fontSize: 13, marginTop: 6 }}>{itens.map((it, i) => <li key={i}>{render(it)}</li>)}</ul>
    </details>
  );
}

const rotulo = (c) => `${c.nomeSocial || c.nome} — ${c.loja}`;

export default function ConcederSelos() {
  const [selos, setSelos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [seloId, setSeloId] = useState('');
  const [periodoRef, setPeriodoRef] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [data, setData] = useState(hojeLocal());
  const [escolhidos, setEscolhidos] = useState([]);
  const [busca, setBusca] = useState('');
  const [textoCpfs, setTextoCpfs] = useState('');
  const [textoArquivo, setTextoArquivo] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    fetch('/api/selos').then((r) => r.json()).then((d) => setSelos((d.selos || []).filter((s) => s.ativo)));
    fetch('/api/colaboradores').then((r) => r.json()).then((l) => setColaboradores(Array.isArray(l) ? l.filter((c) => c.ativo) : []));
  }, []);

  const selo = useMemo(() => selos.find((s) => s.id === seloId) || null, [selos, seloId]);
  const exigeRef = !!selo && selo.grupo === 'presenca';

  function invalidar() { setPrevia(null); setResultado(null); setErro(''); }

  function escolher(valor) {
    setBusca(valor);
    const c = colaboradores.find((x) => rotulo(x) === valor);
    if (c && !escolhidos.some((e) => e.id === c.id)) {
      setEscolhidos([...escolhidos, c]);
      setBusca('');
      invalidar();
    }
  }

  function lerArquivo(e) {
    const file = e.target.files[0];
    setTextoArquivo(''); setNomeArquivo(''); invalidar();
    if (!file) return;
    const leitor = new FileReader();
    leitor.onload = (evt) => {
      try {
        const texto = /\.(xlsx|xls)$/i.test(file.name) ? planilhaParaTexto(XLSX, evt.target.result) : String(evt.target.result);
        setTextoArquivo(texto);
        setNomeArquivo(file.name);
      } catch {
        setErro('Não consegui ler esse arquivo. Use uma planilha (.xlsx), um .csv ou um .txt.');
      }
    };
    if (/\.(xlsx|xls)$/i.test(file.name)) leitor.readAsArrayBuffer(file);
    else leitor.readAsText(file);
  }

  function corpo(extra) {
    return {
      seloId,
      texto: `${textoCpfs}\n${textoArquivo}`,
      colaboradorIds: escolhidos.map((c) => c.id),
      periodoRef: periodoRef || null,
      mensagem,
      data,
      ...extra,
    };
  }

  async function chamar(extra) {
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/selos/conceder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo(extra)) });
      const json = await res.json();
      if (!res.ok) { setErro(json.erro || 'Erro ao conferir.'); return null; }
      return json;
    } catch (e) {
      setErro(e.message || 'Erro inesperado.');
      return null;
    } finally {
      setCarregando(false);
    }
  }

  async function conferir() {
    setResultado(null);
    const r = await chamar({ simular: true });
    if (r) setPrevia(r);
  }

  async function conceder() {
    const r = await chamar({ simular: false });
    if (r) { setResultado(r); setPrevia(null); setEscolhidos([]); setTextoCpfs(''); setTextoArquivo(''); setNomeArquivo(''); }
  }

  const podeConferir = !!seloId && (!exigeRef || !!periodoRef) && (escolhidos.length > 0 || textoCpfs.trim() || textoArquivo);

  return (
    <div>
      <BotaoVoltar />
      <h2>Conceder selos</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Escolha o selo e as pessoas, confira a prévia e confirme. Para presença, suba só a lista de quem se
        qualificou (os CPFs são encontrados sozinhos em qualquer planilha, .csv ou texto).
      </p>

      <div className="card">
        <label>Selo</label>
        <select value={seloId} onChange={(e) => { setSeloId(e.target.value); invalidar(); }}>
          <option value="">Escolha...</option>
          {selos.map((s) => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}
        </select>

        {exigeRef && (
          <>
            <label>Mês de referência (obrigatório para presença)</label>
            <input type="month" value={periodoRef} onChange={(e) => { setPeriodoRef(e.target.value); invalidar(); }} />
          </>
        )}

        <label>Data da conquista</label>
        <input type="date" value={data} onChange={(e) => { setData(e.target.value); invalidar(); }} />

        <label>Mensagem para o colaborador (opcional, aparece no selo)</label>
        <input value={mensagem} maxLength={200} onChange={(e) => { setMensagem(e.target.value); invalidar(); }} placeholder="Ex: Obrigado por cobrir o turno de sábado!" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quem recebe</h3>
        <label>Buscar pelo nome (escolha na lista para adicionar)</label>
        <input list="lista-colab-selos" value={busca} onChange={(e) => escolher(e.target.value)} placeholder="Digite para buscar..." />
        <datalist id="lista-colab-selos">
          {colaboradores.filter((c) => !escolhidos.some((e) => e.id === c.id)).map((c) => <option key={c.id} value={rotulo(c)} />)}
        </datalist>
        {escolhidos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {escolhidos.map((c) => (
              <span key={c.id} className="badge respondida" style={{ cursor: 'pointer' }}
                onClick={() => { setEscolhidos(escolhidos.filter((e) => e.id !== c.id)); invalidar(); }}>
                {c.nomeSocial || c.nome} ✕
              </span>
            ))}
          </div>
        )}

        <label>Ou cole uma lista de CPFs</label>
        <textarea rows={4} value={textoCpfs} onChange={(e) => { setTextoCpfs(e.target.value); invalidar(); }} placeholder="Um CPF por linha, ou cole direto de uma planilha" />

        <label>Ou suba um arquivo com os CPFs (.xlsx, .csv ou .txt)</label>
        <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={lerArquivo} />
        {nomeArquivo && <p style={{ fontSize: 13, color: 'var(--success)' }}>✓ {nomeArquivo} lido.</p>}

        {erro && <div className="erro">{erro}</div>}
        <button onClick={conferir} disabled={!podeConferir || carregando}>
          {carregando && !previa ? 'Conferindo...' : 'Conferir antes de conceder'}
        </button>
      </div>

      {previa && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Confira antes de conceder</h3>
          <p style={{ fontSize: 14 }}>
            <span style={{ fontSize: 22 }}>{previa.selo.icone}</span> <b>{previa.selo.nome}</b> será concedido a <b>{previa.novos.length}</b> pessoa(s). Nada foi gravado ainda.
          </p>
          <Lista titulo="Vão receber" itens={previa.novos} render={(c) => `${c.nome} — ${c.loja}`} />
          <Lista titulo="Já têm esse selo neste mês de referência (serão pulados)" itens={previa.jaTem} render={(c) => `${c.nome} — ${c.loja}`} cor="var(--muted)" />
          <Lista titulo="Inativos no cadastro (não recebem)" itens={previa.inativos} render={(c) => c.nome} cor="var(--warning)" />
          <Lista titulo="CPF não cadastrado no portal" itens={previa.naoEncontrados} render={(c) => c} cor="var(--warning)" />
          <Lista titulo="Números que não são CPF válido" itens={previa.cpfsInvalidos} render={(c) => c} cor="var(--danger)" />
          <button onClick={conceder} disabled={carregando || previa.novos.length === 0} style={{ marginTop: 14 }}>
            {carregando ? 'Concedendo...' : `Conceder a ${previa.novos.length} pessoa(s)`}
          </button>
        </div>
      )}

      {resultado && (
        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--success)' }}>✓ Selos concedidos</h3>
          <p>{resultado.selo.icone} <b>{resultado.selo.nome}</b> foi concedido a <b>{resultado.criados}</b> pessoa(s). Elas verão o selo em "Minhas conquistas", com a bolinha de novidade na tela inicial.</p>
        </div>
      )}
    </div>
  );
}
