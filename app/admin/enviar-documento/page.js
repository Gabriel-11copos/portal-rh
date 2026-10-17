'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../components/BotaoVoltar';

const MAX_BYTES = 4 * 1024 * 1024;

function normalizar(t) {
  return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EnviarDocumento() {
  const [elenco, setElenco] = useState(null);
  const [busca, setBusca] = useState('');
  const [pessoa, setPessoa] = useState(null);
  const [tipo, setTipo] = useState('');
  const [mes, setMes] = useState(mesAtual());
  const [arquivo, setArquivo] = useState(null);
  const [chaveArquivo, setChaveArquivo] = useState(0);   // muda para limpar o campo do arquivo
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(null);

  useEffect(() => {
    fetch('/api/contracheques/elenco')
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok || !Array.isArray(json)) throw new Error('Não foi possível carregar os colaboradores.');
        setElenco(json.filter((c) => c.ativo).map((c) => ({ ...c, nomeNorm: normalizar(c.nome) })));
      })
      .catch((e) => setErro(e.message));
  }, []);

  const resultados = useMemo(() => {
    const q = normalizar(busca);
    if (!elenco || q.length < 2) return [];
    return elenco.filter((c) => c.nomeNorm.includes(q)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 8);
  }, [elenco, busca]);

  function escolherArquivo(e) {
    setErro(''); setSucesso(null);
    const f = e.target.files[0];
    if (!f) { setArquivo(null); return; }
    if (!/\.pdf$/i.test(f.name)) { setErro('Escolha um arquivo PDF.'); setArquivo(null); return; }
    if (f.size > MAX_BYTES) { setErro('O PDF passa de 4 MB. Use um arquivo menor.'); setArquivo(null); return; }
    setArquivo(f);
  }

  const competencia = mes ? `${mes.slice(5, 7)}/${mes.slice(0, 4)}` : '';
  const pronto = !!pessoa && tipo.trim().length >= 2 && !!competencia && !!arquivo && !enviando;

  async function enviar() {
    if (!window.confirm(`Enviar "${tipo.trim()}" (${competencia}) para ${pessoa.nome}? Ele passa a ver em Documentos.`)) return;
    setEnviando(true); setErro(''); setSucesso(null);
    const form = new FormData();
    form.set('arquivo', arquivo);
    form.set('colaboradorId', pessoa.id);
    form.set('tipo', tipo.trim());
    form.set('competencia', competencia);
    try {
      const r = await fetch('/api/contracheques/publicar', { method: 'POST', body: form });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro || 'Não foi possível enviar.'); return; }
      setSucesso({ nome: pessoa.nome, tipo: tipo.trim(), competencia, acao: j.acao });
      setArquivo(null); setChaveArquivo((n) => n + 1);
    } catch (e) {
      setErro(e.message || 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Enviar documento a um colaborador</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
        Escolha a pessoa, o tipo do documento e o PDF. Ele aparece em <b>Documentos</b> do colaborador e fica guardado no Drive
        em <b>Loja › Ano › Colaborador › Mês</b>. Para contracheques de várias pessoas de uma vez, use{' '}
        <Link href="/admin/contracheques">Distribuir contracheques</Link>.
      </p>
      {erro && <div className="erro">{erro}</div>}
      {sucesso && (
        <div className="card" style={{ borderColor: 'var(--success)' }}>
          <b style={{ color: 'var(--success)' }}>✓ Enviado para {sucesso.nome}</b>
          <div style={{ fontSize: 13 }}>
            {sucesso.tipo} · {sucesso.competencia}.{' '}
            {sucesso.acao === 'substituido' ? 'Já havia este documento neste mês: o novo substituiu o anterior.' : 'Ele já pode ver em Documentos.'}
          </div>
        </div>
      )}

      <div className="card">
        <label>Colaborador</label>
        {pessoa ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div><b>{pessoa.nome}</b> <span style={{ color: 'var(--muted)', fontSize: 13 }}>· {pessoa.loja}</span></div>
            <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { setPessoa(null); setBusca(''); setSucesso(null); }}>Trocar</button>
          </div>
        ) : (
          <>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite parte do nome..." disabled={!elenco} />
            {!elenco && !erro && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Carregando colaboradores...</p>}
            {busca.trim().length >= 2 && elenco && resultados.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Ninguém encontrado com esse nome (só aparecem colaboradores ativos).</p>}
            {resultados.map((c) => (
              <button key={c.id} type="button" className="secundario" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }} onClick={() => { setPessoa(c); setSucesso(null); }}>
                {c.nome} <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {c.loja}</span>
              </button>
            ))}
          </>
        )}

        <label>Tipo do documento</label>
        <input list="tipos-doc-individual" value={tipo} maxLength={40} onChange={(e) => { setTipo(e.target.value); setSucesso(null); }} placeholder="Ex: Atestado, Contrato, Termo..." />
        <datalist id="tipos-doc-individual">
          <option value="Contracheque" /><option value="Contracheque de 13º salário" /><option value="Atestado" /><option value="Contrato" /><option value="Termo" /><option value="Comprovante" /><option value="Informe de rendimentos" />
        </datalist>

        <label>Mês de referência</label>
        <input type="month" value={mes} onChange={(e) => { setMes(e.target.value); setSucesso(null); }} style={{ maxWidth: 220 }} />

        <label>Arquivo PDF</label>
        <input key={chaveArquivo} type="file" accept=".pdf,application/pdf" onChange={escolherArquivo} />
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 10px' }}>
          Se já existir este tipo de documento neste mês para a pessoa, o novo substitui o anterior.
        </p>

        <button type="button" disabled={!pronto} onClick={enviar}>{enviando ? 'Enviando...' : 'Enviar documento'}</button>
      </div>
    </div>
  );
}
