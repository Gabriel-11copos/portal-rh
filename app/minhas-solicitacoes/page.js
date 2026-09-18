'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const rotulos = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
};

function CartaoSolicitacao({ s, onAtualizar }) {
  const [texto, setTexto] = useState('');
  const [avaliando, setAvaliando] = useState(false);
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState('');

  async function enviarMensagem(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    await fetch(`/api/solicitacoes/${s.id}/mensagem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    setTexto('');
    onAtualizar();
  }

  async function encerrarComAvaliacao(e) {
    e.preventDefault();
    await fetch(`/api/solicitacoes/${s.id}/avaliar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nota, comentario }),
    });
    setAvaliando(false);
    onAtualizar();
  }

  const respostasOrdenadas = [...s.respostas].sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b>{s.assunto.nome}</b>
        <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>{s.descricao}</p>

      {respostasOrdenadas.map((r) => (
        <div
          key={r.id}
          style={{
            background: r.autor === 'rh' ? 'var(--pastel-blue)' : '#f1f5f9',
            padding: 10,
            borderRadius: 8,
            marginTop: 8,
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            {r.autor === 'rh' ? (r.nomeAutor || 'RH/DP') : 'Você'}
            {r.automatica && ' · resposta automática'}
          </div>
          {r.texto}
        </div>
      ))}

      {s.anexos.filter((a) => a.enviadoPor === 'rh').map((a) => (
        <div key={a.id} style={{ marginTop: 6 }}>
          <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
        </div>
      ))}

      {s.status === 'encerrada' && s.avaliacaoNota && (
        <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 8 }}>
          Você avaliou este atendimento: {s.avaliacaoNota}/5 {s.avaliacaoComentario && `— "${s.avaliacaoComentario}"`}
        </p>
      )}

      {s.status !== 'encerrada' && !avaliando && (
        <div style={{ marginTop: 12 }}>
          <form onSubmit={enviarMensagem}>
            <textarea rows={2} placeholder="Responder..." value={texto} onChange={(e) => setTexto(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit">Enviar</button>
              <button type="button" className="secundario" onClick={() => setAvaliando(true)}>
                Encerrar e avaliar
              </button>
            </div>
          </form>
        </div>
      )}

      {avaliando && (
        <form onSubmit={encerrarComAvaliacao} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <label>Nota do atendimento (1 a 5)</label>
          <select value={nota} onChange={(e) => setNota(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label>Comentário (opcional)</label>
          <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">Confirmar encerramento</button>
            <button type="button" className="secundario" onClick={() => setAvaliando(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function MinhasSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [comunicados, setComunicados] = useState([]);

  function carregar() {
    fetch('/api/solicitacoes').then((r) => r.json()).then(setSolicitacoes);
    fetch('/api/comunicados').then((r) => r.json()).then(setComunicados);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Minhas solicitações</h2>
        <Link href="/nova-solicitacao"><button>+ Nova solicitação</button></Link>
      </div>

      {solicitacoes.length === 0 && <p>Você ainda não abriu nenhuma solicitação.</p>}

      {solicitacoes.map((s) => (
        <CartaoSolicitacao key={s.id} s={s} onAtualizar={carregar} />
      ))}

      {comunicados.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>Comunicados recebidos do RH</h3>
          {comunicados.map((c) => (
            <div key={c.id} className="card">
              <b>{c.assunto}</b>
              <p style={{ fontSize: 14 }}>{c.texto}</p>
              {c.anexos.map((a) => (
                <div key={a.id}>
                  <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
