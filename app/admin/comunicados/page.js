'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import UploadAnexo from '../../components/UploadAnexo';
import BotaoVoltar from '../../components/BotaoVoltar';

export default function EnviarComunicado() {
  const router = useRouter();
  const [colaboradores, setColaboradores] = useState([]);
  const [busca, setBusca] = useState('');
  const [lojaFiltro, setLojaFiltro] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/colaboradores').then((r) => r.json()).then(setColaboradores);
  }, []);

  const lojas = useMemo(
    () => [...new Set(colaboradores.map((c) => c.loja))].sort(),
    [colaboradores]
  );

  const filtrados = useMemo(() => {
    return colaboradores.filter((c) => {
      const nomeExibido = c.nomeSocial || c.nome;
      const bateBusca = !busca || nomeExibido.toLowerCase().includes(busca.toLowerCase());
      const bateLoja = !lojaFiltro || c.loja === lojaFiltro;
      return bateBusca && bateLoja;
    });
  }, [colaboradores, busca, lojaFiltro]);

  function alternar(id) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionados(novo);
  }

  function selecionarTodosFiltrados() {
    const novo = new Set(selecionados);
    filtrados.forEach((c) => novo.add(c.id));
    setSelecionados(novo);
  }

  function limparSelecao() {
    setSelecionados(new Set());
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (selecionados.size === 0) {
      setErro('Selecione pelo menos um colaborador.');
      return;
    }
    setEnviando(true);
    const res = await fetch('/api/comunicados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colaboradorIds: [...selecionados], assunto, texto, anexos }),
    });
    setEnviando(false);
    if (res.ok) {
      setEnviado(true);
    } else {
      const data = await res.json();
      setErro(data.erro || 'Erro ao enviar.');
    }
  }

  if (enviado) {
    return (
      <div className="card">
        <h2>Comunicado enviado para {selecionados.size} colaborador(es)!</h2>
        <button onClick={() => router.push('/admin')}>Voltar ao painel</button>
      </div>
    );
  }

  return (
    <div>
      <BotaoVoltar />
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Enviar comunicado</h2>
          <button className="secundario" onClick={() => router.push('/admin/comunicados/historico')}>
            Ver histórico
          </button>
        </div>
        <form onSubmit={enviar}>
        <label>Assunto</label>
        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} required />

        <label>Mensagem</label>
        <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} required />

        <UploadAnexo onUploaded={(a) => setAnexos([...anexos, a])} />
        {anexos.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>)}

        <label style={{ marginTop: 16 }}>Destinatários ({selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''})</label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 0 }} />
          <select value={lojaFiltro} onChange={(e) => setLojaFiltro(e.target.value)} style={{ marginBottom: 0, maxWidth: 220 }}>
            <option value="">Todas as lojas</option>
            {lojas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" className="secundario" onClick={selecionarTodosFiltrados}>
            Selecionar todos os filtrados ({filtrados.length})
          </button>
          <button type="button" className="secundario" onClick={limparSelecao}>Limpar seleção</button>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8, marginBottom: 12 }}>
          {filtrados.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selecionados.has(c.id)}
                onChange={() => alternar(c.id)}
                style={{ width: 'auto', margin: 0 }}
              />
              <span>{c.nomeSocial || c.nome} <span style={{ color: 'var(--muted)' }}>· {c.loja}</span></span>
            </label>
          ))}
          {filtrados.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum colaborador encontrado.</p>}
        </div>

        {erro && <div className="erro">{erro}</div>}

        <button type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar comunicado'}</button>
      </form>
      </div>
    </div>
  );
}
