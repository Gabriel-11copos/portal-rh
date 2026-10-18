'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

const VAZIO = { nome: '', prazoPadraoDias: 5, responsavelPadrao: '', respostaAutomatica: '', ativo: true };

export default function GerenciarAssuntos() {
  const [assuntos, setAssuntos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [ehMaster, setEhMaster] = useState(false);          // só o master escolhe quem atende cada assunto
  const [usuarios, setUsuarios] = useState([]);              // quem pode atender (usuários do painel com acesso)
  const [atendentes, setAtendentes] = useState({});          // assuntoId -> [usuarioId]
  const [escolhidos, setEscolhidos] = useState([]);          // quem atende o assunto que está no formulário
  const [erro, setErro] = useState('');

  function carregar() {
    fetch('/api/assuntos').then((r) => r.json()).then(setAssuntos);
  }
  useEffect(carregar, []);

  // o master vê e escolhe quem atende cada assunto (quem atende só vê as solicitações dos assuntos dele)
  async function carregarAtendentes() {
    try {
      const a = await fetch('/api/acesso').then((r) => r.json());
      if (a.perfil !== 'master') return;
      const p = await fetch('/api/permissoes').then((r) => r.json());
      if (!Array.isArray(p.usuarios)) return;
      setEhMaster(true);
      setUsuarios(p.usuarios.filter((u) => u.perfil !== 'sem_acesso'));
      const mapa = {};
      for (const u of p.usuarios) for (const x of u.assuntos || []) (mapa[x.id] = mapa[x.id] || []).push(u.id);
      setAtendentes(mapa);
    } catch { /* sem isso, a tela funciona como antes (sem a escolha de quem atende) */ }
  }
  useEffect(() => { carregarAtendentes(); }, []);

  function editar(a) {
    setEditandoId(a.id);
    setForm({
      nome: a.nome,
      prazoPadraoDias: a.prazoPadraoDias,
      responsavelPadrao: a.responsavelPadrao || '',
      respostaAutomatica: a.respostaAutomatica || '',
      ativo: a.ativo,
    });
    setEscolhidos(atendentes[a.id] || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(VAZIO);
    setEscolhidos([]);
  }

  async function salvar(e) {
    e.preventDefault();
    const payload = { ...form, prazoPadraoDias: Number(form.prazoPadraoDias) };

    setErro('');
    let assuntoId = editandoId;
    if (editandoId) {
      await fetch(`/api/assuntos/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      const res = await fetch('/api/assuntos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      try { assuntoId = (await res.json()).id; } catch { assuntoId = null; }
    }
    // quem atende o assunto (só o master escolhe)
    if (ehMaster && assuntoId) {
      const r = await fetch(`/api/assuntos/${assuntoId}/responsaveis`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioIds: escolhidos }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErro(`O assunto foi salvo, mas não foi possível salvar quem atende: ${j.erro || 'erro desconhecido'}`);
      }
    }
    cancelarEdicao();
    carregar();
    carregarAtendentes();
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Assuntos (RH e DP)</h2>

      {erro && <div className="erro">{erro}</div>}
      <div className="card">
        <h3>{editandoId ? 'Editar assunto' : 'Novo assunto'}</h3>
        <form onSubmit={salvar}>
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />

          <label>Prazo padrão (dias úteis)</label>
          <input type="number" value={form.prazoPadraoDias} onChange={(e) => setForm({ ...form, prazoPadraoDias: e.target.value })} required />

          <label>Responsável padrão (ex: RH, DP, Financeiro)</label>
          <input value={form.responsavelPadrao} onChange={(e) => setForm({ ...form, responsavelPadrao: e.target.value })} />

          <label>Resposta automática (opcional — se preenchido, responde sozinho na hora)</label>
          <textarea rows={3} value={form.respostaAutomatica} onChange={(e) => setForm({ ...form, respostaAutomatica: e.target.value })} />

          {ehMaster && (
            <div style={{ margin: '8px 0' }}>
              <label>Quem atende este assunto (opcional)</label>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px' }}>
                As solicitações deste assunto chegam para essas pessoas, que veem só os assuntos que atendem.
                O master e quem tiver "Ver todas as solicitações" continuam vendo tudo.
              </p>
              {usuarios.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <input
                    type="checkbox"
                    checked={escolhidos.includes(u.id)}
                    onChange={() => setEscolhidos(escolhidos.includes(u.id) ? escolhidos.filter((x) => x !== u.id) : [...escolhidos, u.id])}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  {u.nome}
                </label>
              ))}
            </div>
          )}

          {editandoId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                style={{ width: 'auto', margin: 0 }}
              />
              Assunto ativo (aparece para o colaborador escolher)
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit">{editandoId ? 'Salvar alterações' : 'Cadastrar assunto'}</button>
            {editandoId && <button type="button" className="secundario" onClick={cancelarEdicao}>Cancelar</button>}
          </div>
        </form>
      </div>

      {assuntos.map((a) => (
        <div key={a.id} className="card" style={{ cursor: 'pointer', opacity: a.ativo ? 1 : 0.5 }} onClick={() => editar(a)}>
          <b>{a.nome}</b> {!a.ativo && <span className="badge encerrada">Inativo</span>} · prazo: {a.prazoPadraoDias} dias úteis · responsável: {a.responsavelPadrao || '-'}
          {a.respostaAutomatica && <p style={{ fontSize: 13, color: 'var(--success)' }}>✓ Resposta automática configurada</p>}
          {ehMaster && (atendentes[a.id] || []).length > 0 && (
            <p style={{ fontSize: 13, margin: '4px 0 0' }}>
              📥 Atende: {(atendentes[a.id] || []).map((id) => (usuarios.find((u) => u.id === id) || {}).nome).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
