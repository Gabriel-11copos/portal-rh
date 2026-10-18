'use client';
import { useEffect, useMemo, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

// <ajudantes>
const ROTULO_PERFIL = { master: 'Master', personalizado: 'Personalizado', sem_acesso: 'Sem acesso' };
const CLASSE_PERFIL = { master: 'respondida', personalizado: 'aberta', sem_acesso: 'encerrada' };

// Agrupa o catálogo de permissões por assunto, mantendo a ordem em que aparecem.
function agruparPorGrupo(catalogo) {
  const grupos = [];
  for (const p of catalogo || []) {
    let g = grupos.find((x) => x.nome === p.grupo);
    if (!g) { g = { nome: p.grupo, itens: [] }; grupos.push(g); }
    g.itens.push(p);
  }
  return grupos;
}

// Resumo curto do que a pessoa pode fazer, para a lista.
function resumoDoAcesso(u, catalogo) {
  if (u.perfil === 'master') return 'Acesso total, inclusive usuários e permissões';
  if (u.perfil === 'sem_acesso') return 'Não consegue entrar no painel';
  const nomes = (u.permissoes || []).map((c) => (catalogo.find((p) => p.chave === c) || {}).rotulo).filter(Boolean);
  return nomes.length ? nomes.join(' · ') : 'Nenhuma permissão marcada';
}
// </ajudantes>

export default function Permissoes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [editando, setEditando] = useState(null);   // { id, perfil, permissoes }
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      const r = await fetch('/api/permissoes');
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
      setDados(j);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function ativar() {
    if (!window.confirm('Ativar o controle de permissões? Todos os usuários de hoje continuam com acesso total (nada muda para ninguém). Depois você limita quem quiser. Usuários criados daqui para frente começam SEM acesso até você liberar.')) return;
    setErro(''); setMsg('');
    const r = await fetch('/api/permissoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'ativar' }) });
    const j = await r.json();
    if (!r.ok) { setErro(j.erro || 'Não foi possível ativar.'); return; }
    setMsg('Controle de permissões ativado. Agora ajuste o acesso de cada pessoa.');
    carregar();
  }

  async function salvar() {
    setSalvando(true); setErro(''); setMsg('');
    try {
      const r = await fetch(`/api/permissoes/${editando.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: editando.perfil, permissoes: editando.permissoes }) });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro || 'Não foi possível salvar.'); return; }
      const nome = dados.usuarios.find((u) => u.id === editando.id).nome;
      setEditando(null);
      setMsg(`Acesso de ${nome} salvo. Vale em até 1 ou 2 minutos para quem está usando o painel, ou na próxima vez que a pessoa entrar.`);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  function alternar(chave) {
    const tem = editando.permissoes.includes(chave);
    setEditando({ ...editando, permissoes: tem ? editando.permissoes.filter((c) => c !== chave) : [...editando.permissoes, chave] });
  }

  const grupos = useMemo(() => agruparPorGrupo(dados && dados.catalogo), [dados]);

  return (
    <div>
      <BotaoVoltar />
      <h2>Permissões</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
        Defina o que cada usuário do painel pode fazer. <b>Master</b> faz tudo. <b>Personalizado</b> faz só o que você marcar, e vê as solicitações
        dos assuntos que atende (você escolhe quem atende cada assunto na tela de Assuntos).
      </p>
      {erro && <div className="erro">{erro}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--success)' }}>{msg}</p>}

      {dados && !dados.middlewareAtivo && (
        <div className="erro">
          A proteção por permissões não parece estar ativa neste momento. Enquanto isso, só usuários master conseguem usar o painel.
          Confira se o arquivo <b>middleware.js</b> foi enviado ao site.
        </div>
      )}
      {dados && dados.semTabela && <div className="erro">As tabelas das permissões ainda não foram criadas no banco. Rode o arquivo SQL desta entrega no Neon.</div>}

      {dados && !dados.semTabela && !dados.ativo && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Ativar o controle de permissões</h3>
          <p style={{ fontSize: 14 }}>
            Hoje todos os usuários têm acesso total. Ao ativar, <b>todos continuam com acesso total</b> (nada muda para ninguém) e você passa a poder
            limitar quem quiser. Usuários criados depois começam <b>sem acesso</b> até você liberar.
          </p>
          <button type="button" onClick={ativar}>Ativar controle de permissões</button>
        </div>
      )}

      {dados && dados.ativo && dados.usuarios.map((u) => {
        const eu = u.id === dados.euId;
        const abrindo = editando && editando.id === u.id;
        return (
          <div key={u.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <b>{u.nome}</b>{eu && <span style={{ color: 'var(--muted)', fontSize: 12 }}> (você)</span>}
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
              </div>
              <span className={`badge ${CLASSE_PERFIL[u.perfil]}`}>{ROTULO_PERFIL[u.perfil]}</span>
            </div>
            {!abrindo && (
              <>
                <div style={{ fontSize: 13, marginTop: 6 }}>{resumoDoAcesso(u, dados.catalogo)}</div>
                {u.assuntos.length > 0 && <div style={{ fontSize: 13, marginTop: 4 }}>📥 Atende: {u.assuntos.map((a) => a.nome).join(', ')}</div>}
                <button type="button" className="secundario" style={{ marginTop: 8, padding: '4px 12px', fontSize: 13 }}
                  onClick={() => setEditando({ id: u.id, perfil: u.perfil, permissoes: [...u.permissoes] })}>Editar acesso</button>
              </>
            )}
            {abrindo && (
              <div style={{ marginTop: 10 }}>
                <label>Perfil</label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                  {['master', 'personalizado', 'sem_acesso'].map((p) => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: eu && p !== 'master' ? 0.5 : 1 }}>
                      <input type="radio" name={`perfil-${u.id}`} checked={editando.perfil === p} disabled={eu && p !== 'master'}
                        onChange={() => setEditando({ ...editando, perfil: p })} style={{ width: 'auto', margin: 0 }} />
                      {ROTULO_PERFIL[p]}
                    </label>
                  ))}
                </div>
                {eu && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Você não pode tirar o seu próprio acesso de master. Peça a outro master.</p>}
                {editando.perfil === 'personalizado' && (
                  <div>
                    {grupos.map((g) => (
                      <div key={g.nome} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>{g.nome}</div>
                        {g.itens.map((p) => (
                          <label key={p.chave} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', fontSize: 14 }}>
                            <input type="checkbox" checked={editando.permissoes.includes(p.chave)} onChange={() => alternar(p.chave)} style={{ width: 'auto', margin: '3px 0 0' }} />
                            <span>{p.rotulo}{p.ajuda && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{p.ajuda}</span>}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button type="button" className="secundario" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setEditando({ ...editando, permissoes: dados.catalogo.map((p) => p.chave) })}>Marcar tudo</button>
                      <button type="button" className="secundario" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setEditando({ ...editando, permissoes: [] })}>Limpar</button>
                    </div>
                  </div>
                )}
                {editando.perfil === 'sem_acesso' && <p style={{ fontSize: 13, color: 'var(--warning)' }}>Esta pessoa não conseguirá entrar no painel.</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="secundario" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
