'use client';
import { useEffect, useMemo, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import UploadAnexo from '../components/UploadAnexo';
import Avatar from '../components/Avatar';
import BotaoVoltar from '../components/BotaoVoltar';

// <ajudantes>
const rotulos = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
};

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'aberta', texto: 'Abertas' },
  { valor: 'em_analise', texto: 'Em análise' },
  { valor: 'respondida', texto: 'Respondidas' },
  { valor: 'encerrada', texto: 'Encerradas' },
];

function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${aa} ${hh}:${min}`;
}

function formatarData(iso) {
  return iso ? formatarDataHora(iso).slice(0, 8) : '';
}

// Quantas solicitações há em cada situação (e no total), para os números dos filtros.
function contarPorStatus(lista) {
  const c = { todas: lista.length, aberta: 0, em_analise: 0, respondida: 0, encerrada: 0 };
  for (const s of lista) if (c[s.status] !== undefined) c[s.status] += 1;
  return c;
}

function filtrar(lista, filtro) {
  return filtro === 'todas' ? lista : lista.filter((s) => s.status === filtro);
}

// Mensagens da conversa em ordem: o texto que abriu a solicitação e depois as respostas.
function montarConversa(s) {
  const inicial = { id: 'inicial', autor: 'colaborador', texto: s.descricao, data: s.dataAbertura };
  const respostas = [...(s.respostas || [])].sort((a, b) => new Date(a.data) - new Date(b.data));
  return [inicial, ...respostas];
}

function ultimaAtividade(s) {
  const conversa = montarConversa(s);
  return conversa[conversa.length - 1].data || s.dataAbertura;
}

// As mais recentes primeiro (pela última mensagem).
function ordenar(lista) {
  return [...lista].sort((a, b) => new Date(ultimaAtividade(b)) - new Date(ultimaAtividade(a)));
}

// Prévia da última mensagem, para bater o olho sem abrir a caixinha.
function previa(s) {
  const conversa = montarConversa(s);
  const r = conversa[conversa.length - 1];
  const quem = r.autor === 'colaborador' ? 'Você' : (r.nomeAutor || 'RH/DP');
  const texto = String(r.texto || '').replace(/\s+/g, ' ').trim();
  return `${quem}: ${texto.length > 90 ? `${texto.slice(0, 90).trim()}…` : texto}`;
}
// </ajudantes>

function CartaoSolicitacao({ s, onAtualizar, perfil }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [anexosNovos, setAnexosNovos] = useState([]);
  const [avaliando, setAvaliando] = useState(false);
  const [nota, setNota] = useState(5);

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
      body: JSON.stringify({ nota }),
    });
    setAvaliando(false);
    onAtualizar();
  }

  const nomeExibido = perfil?.nomeSocial || perfil?.nome || 'Você';
  const conversa = montarConversa(s);
  const anexos = s.anexos || [];
  const nova = s.vistoColaborador === false && s.status !== 'encerrada';

  function alternar() { setAberto((v) => !v); }

  return (
    <div className="card">
      {/* cabeçalho: sempre visível; clicar abre e fecha a conversa */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={aberto}
        onClick={alternar}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } }}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <span className="numero-solicitacao">#{s.numero} · </span>
            <b>{s.assunto.nome}</b>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {nova && <span className="badge aberta">Nova resposta</span>}
            <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
            <span aria-hidden="true" style={{ color: 'var(--muted)' }}>{aberto ? '▾' : '▸'}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          Aberta em {formatarData(s.dataAbertura)} · última mensagem {formatarDataHora(ultimaAtividade(s))}
        </div>
        {!aberto && <div style={{ fontSize: 13, marginTop: 6, color: 'var(--muted)' }}>{previa(s)}</div>}
      </div>

      {aberto && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {s.status !== 'encerrada' && s.prazo && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>
              Previsão de resposta: {new Date(s.prazo).toLocaleDateString('pt-BR')}
            </p>
          )}

          {conversa.map((r) => {
            const isColab = r.autor === 'colaborador';
            const nomeAvatar = isColab ? nomeExibido : (r.nomeAutor || 'RH');
            return (
              <div key={r.id} className="linha-mensagem" style={{ justifyContent: isColab ? 'flex-end' : 'flex-start' }}>
                {!isColab && <Avatar fotoUrl={r.autorFotoUrl} nome={nomeAvatar} size={28} />}
                <div className={`bolha ${r.autor}`}>
                  <div className="autor">
                    {isColab ? 'Você' : (r.nomeAutor || 'RH/DP')}
                    {r.automatica && ' · resposta automática'}
                  </div>
                  {r.texto}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                    {formatarDataHora(r.data)}
                  </div>
                </div>
                {isColab && <Avatar fotoUrl={perfil?.fotoUrl} nome={nomeAvatar} size={28} />}
              </div>
            );
          })}

          {anexos.map((a) => (
            <div key={a.id} style={{ marginTop: 6 }}>
              <a href={a.linkDrive} target="_blank" rel="noreferrer">
                📎 {a.nomeArquivo} {a.enviadoPor === 'rh' ? '(do RH)' : '(enviado por você)'}
              </a>
            </div>
          ))}

          {s.status === 'encerrada' && s.avaliacaoNota && (
            <p style={{ fontSize: 14, marginTop: 8 }}>
              Sua avaliação:{' '}
              <span style={{ color: '#f5b301', fontSize: 18 }}>
                {'★'.repeat(s.avaliacaoNota)}{'☆'.repeat(5 - s.avaliacaoNota)}
              </span>
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
              <label>Avalie o atendimento</label>
              <div style={{ display: 'flex', gap: 6, fontSize: 30, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    onClick={() => setNota(n)}
                    style={{ cursor: 'pointer', color: n <= nota ? '#f5b301' : '#d1d5db', lineHeight: 1 }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit">Confirmar encerramento</button>
                <button type="button" className="secundario" onClick={() => setAvaliando(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function MinhasSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [comunicados, setComunicados] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [filtro, setFiltro] = useState('todas');

  async function lerJson(url) {
    try {
      const r = await fetch(url);
      return await r.json();
    } catch {
      return null;
    }
  }

  async function carregar() {
    const [sol, com, per] = await Promise.all([lerJson('/api/solicitacoes'), lerJson('/api/comunicados'), lerJson('/api/perfil')]);
    setSolicitacoes(Array.isArray(sol) ? sol : []);
    setComunicados(Array.isArray(com) ? com : []);
    setPerfil(per && !per.erro ? per : null);
    // marca como vistas DEPOIS de carregar: assim a lista ainda sabe quais tinham resposta nova
    fetch('/api/solicitacoes/marcar-vistas', { method: 'POST' });
  }

  useEffect(() => { carregar(); }, []);

  const contagem = useMemo(() => contarPorStatus(solicitacoes), [solicitacoes]);
  const visiveis = useMemo(() => ordenar(filtrar(solicitacoes, filtro)), [solicitacoes, filtro]);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minhas solicitações</h2>

      {solicitacoes.length === 0 && <p>Você ainda não abriu nenhuma solicitação.</p>}

      {solicitacoes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={filtro === f.valor ? '' : 'secundario'}
              aria-pressed={filtro === f.valor}
              style={{ padding: '4px 12px', fontSize: 13 }}
              onClick={() => setFiltro(f.valor)}
            >
              {f.texto} ({contagem[f.valor]})
            </button>
          ))}
        </div>
      )}

      {solicitacoes.length > 0 && visiveis.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>Nenhuma solicitação neste filtro.</p>
      )}

      {visiveis.map((s) => (
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
              {(c.anexos || []).map((a) => (
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
