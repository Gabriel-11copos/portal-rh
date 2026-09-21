'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

const VAZIO = { nome: '', prazoPadraoDias: 5, responsavelPadrao: '', respostaAutomatica: '', ativo: true };

export default function GerenciarAssuntos() {
  const [assuntos, setAssuntos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);

  function carregar() {
    fetch('/api/assuntos').then((r) => r.json()).then(setAssuntos);
  }
  useEffect(carregar, []);

  function editar(a) {
    setEditandoId(a.id);
    setForm({
      nome: a.nome,
      prazoPadraoDias: a.prazoPadraoDias,
      responsavelPadrao: a.responsavelPadrao || '',
      respostaAutomatica: a.respostaAutomatica || '',
      ativo: a.ativo,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(VAZIO);
  }

  async function salvar(e) {
    e.preventDefault();
    const payload = { ...form, prazoPadraoDias: Number(form.prazoPadraoDias) };

    if (editandoId) {
      await fetch(`/api/assuntos/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/assuntos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    cancelarEdicao();
    carregar();
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Assuntos (RH e DP)</h2>

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
        </div>
      ))}
    </div>
  );
}
