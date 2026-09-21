'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import UploadAnexo from '../components/UploadAnexo';
import Avatar from '../components/Avatar';
import BotaoVoltar from '../components/BotaoVoltar';

const rotulos = {
  aberta: 'Pendente',
  em_analise: 'Pendente',
  respondida: 'Em andamento',
  encerrada: 'Encerrada',
};

function CartaoSolicitacao({ s, onAtualizar, perfil }) {
  const [texto, setTexto] = useState('');
  const [anexosNovos, setAnexosNovos] = useState([]);
  const [avaliando, setAvaliando] = useState(false);
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState('');

  async function enviarMensagem(e) {
    e.preventDefault();
    if (!texto.trim() && anexosNovos.length === 0) return;
    await fetch(`/api/solicitacoes/${s.id}/mensagem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, anexos: anexosNovos }),
    });
    setTexto('');
    setAnexosNovos([]);
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
        <div>
          <span className="numero-solicitacao">#{s.numero} · </span>
          <b>{s.assunto.nome}</b>
        </div>
        <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>{s.descricao}</p>
      {s.status !== 'encerrada' && s.prazo && (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Previsão de resposta: {new Date(s.prazo).toLocaleDateString('pt-BR')}
        </p>
      )}

      {respostasOrdenadas.map((r) => {
        const isColab = r.autor === 'colaborador';
        const nomeAvatar = isColab ? (perfil?.nomeSocial || perfil?.nome || 'Você') : (r.nomeAutor || 'RH');
        return (
          <div key={r.id} className="linha-mensagem" style={{ justifyContent: isColab ? 'flex-end' : 'flex-start' }}>
            {!isColab && <Avatar fotoUrl={null} nome={nomeAvatar} size={28} />}
            <div className={`bolha ${r.autor}`}>
              <div className="autor">
                {isColab ? 'Você' : (r.nomeAutor || 'RH/DP')}
                {r.automatica && ' · resposta automática'}
              </div>
              {r.texto}
            </div>
            {isColab && <Avatar fotoUrl={perfil?.fotoUrl} nome={nomeAvatar} size={28} />}
          </div>
        );
      })}

      {s.anexos.map((a) => (
        <div key={a.id} style={{ marginTop: 6 }}>
          <a href={a.linkDrive} target="_blank" rel="noreferrer">
            📎 {a.nomeArquivo} {a.enviadoPor === 'rh' ? '(do RH)' : '(enviado por você)'}
          </a>
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
            <UploadAnexo onUploaded={(a) => setAnexosNovos([...anexosNovos, a])} />
            {anexosNovos.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>)}
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
  const [perfil, setPerfil] = useState(null);

  function carregar() {
    fetch('/api/solicitacoes').then((r) => r.json()).then(setSolicitacoes);
    fetch('/api/comunicados').then((r) => r.json()).then(setComunicados);
    fetch('/api/perfil').then((r) => r.json()).then(setPerfil);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minhas solicitações</h2>

      {solicitacoes.length === 0 && <p>Você ainda não abriu nenhuma solicitação.</p>}

      {solicitacoes.map((s) => (
        <CartaoSolicitacao key={s.id} s={s} onAtualizar={carregar} perfil={perfil} />
      ))}

      {comunicados.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>Comunicados recebidos do RH</h3>
          {comunicados.map((c) => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{c.assunto}</b>
                {!c.lido && <span className="badge aberta">Novo</span>}
              </div>
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
