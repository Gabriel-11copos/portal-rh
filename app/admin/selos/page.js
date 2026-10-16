'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../components/BotaoVoltar';

const GRUPOS = { presenca: 'Presença', reconhecimento: 'Reconhecimento' };
// Datas de calendário ficam guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export default function SelosAdmin() {
  const [dados, setDados] = useState(null);
  const [recentes, setRecentes] = useState([]);
  const [form, setForm] = useState({ nome: '', descricao: '', icone: '', grupo: 'reconhecimento' });
  const [edicao, setEdicao] = useState(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  async function carregar() {
    try {
      const [a, b] = await Promise.all([fetch('/api/selos'), fetch('/api/selos/concedidos')]);
      const sel = await a.json();
      if (!a.ok) throw new Error(sel.erro || 'Erro ao carregar os selos.');
      setDados(sel);
      const rec = await b.json();
      setRecentes(Array.isArray(rec) ? rec : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar os selos.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function enviar(url, metodo, corpo) {
    setErro('');
    setMsg('');
    const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const json = await res.json();
    if (!res.ok) { setErro(json.erro || 'Não foi possível salvar.'); return null; }
    return json;
  }

  async function criar(e) {
    e.preventDefault();
    const ok = await enviar('/api/selos', 'POST', form);
    if (ok) {
      setForm({ nome: '', descricao: '', icone: '', grupo: 'reconhecimento' });
      setMsg('Selo criado!');
      carregar();
    }
  }

  async function salvarEdicao() {
    const ok = await enviar(`/api/selos/${edicao.id}`, 'PATCH', { nome: edicao.nome, descricao: edicao.descricao, icone: edicao.icone });
    if (ok) { setEdicao(null); setMsg('Selo atualizado.'); carregar(); }
  }

  async function alternar(s) {
    const ok = await enviar(`/api/selos/${s.id}`, 'PATCH', { ativo: !s.ativo });
    if (ok) carregar();
  }

  async function remover(g) {
    if (!window.confirm(`Remover o selo "${g.selo}" de ${g.colaborador}? Ele deixa de aparecer para a pessoa.`)) return;
    const ok = await enviar('/api/selos/concedidos', 'DELETE', { id: g.id });
    if (ok) { setMsg('Concessão removida.'); carregar(); }
  }

  return (
    <div>
      <BotaoVoltar />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Selos</h2>
        <Link href="/admin/selos/conceder"><button>Conceder selos</button></Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Tempo de casa e aniversário são automáticos. Presença e reconhecimentos você concede. O colaborador vê
        tudo em "Minhas conquistas".
      </p>
      {erro && <div className="erro">{erro}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--success)' }}>{msg}</p>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Novo selo</h3>
        <form onSubmit={criar}>
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Salvou o Turno" required />
          <label>Ícone (um emoji)</label>
          <input value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} placeholder="🏆" style={{ maxWidth: 120 }} required />
          <label>Descrição (aparece para o colaborador)</label>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Cobriu um turno quando a equipe precisou" />
          <label>Grupo</label>
          <select value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })}>
            <option value="reconhecimento">Reconhecimento (dado pelo RH quando acontecer)</option>
            <option value="presenca">Presença (por mês de referência)</option>
          </select>
          <button type="submit">Criar selo</button>
        </form>
      </div>

      <h3>Selos que você concede</h3>
      {dados && dados.selos.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum selo criado ainda.</p>}
      {dados && dados.selos.map((s) => (
        <div key={s.id} className="card" style={{ opacity: s.ativo ? 1 : 0.55 }}>
          {edicao && edicao.id === s.id ? (
            <div>
              <label>Nome</label>
              <input value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
              <label>Ícone</label>
              <input value={edicao.icone} onChange={(e) => setEdicao({ ...edicao, icone: e.target.value })} style={{ maxWidth: 120 }} />
              <label>Descrição</label>
              <input value={edicao.descricao} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={salvarEdicao}>Salvar</button>
                <button type="button" className="secundario" onClick={() => setEdicao(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 24, marginRight: 8 }}>{s.icone}</span>
                <b>{s.nome}</b>{' '}
                <span className="badge encerrada">{GRUPOS[s.grupo] || s.grupo}</span>
                {!s.ativo && <span className="badge encerrada" style={{ marginLeft: 6 }}>Desativado</span>}
                {s.descricao && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{s.descricao}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => setEdicao({ id: s.id, nome: s.nome, descricao: s.descricao || '', icone: s.icone })}>Editar</button>
                <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => alternar(s)}>
                  {s.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {dados && (
        <>
          <h3>Selos automáticos</h3>
          <div className="card">
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>Calculados sozinhos, a partir da data de admissão e de nascimento.</p>
            {dados.automaticos.tempo.map((t) => (
              <div key={t.codigo} style={{ fontSize: 14, padding: '3px 0' }}>{t.icone} <b>{t.nome}</b> · {t.descricao}</div>
            ))}
            <div style={{ fontSize: 14, padding: '3px 0' }}>{dados.automaticos.aniversario.icone} <b>{dados.automaticos.aniversario.nome}</b> · {dados.automaticos.aniversario.descricao}</div>
          </div>
        </>
      )}

      <h3>Concessões recentes</h3>
      {recentes.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum selo concedido ainda.</p>}
      {recentes.map((g) => (
        <div key={g.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <b>{g.icone} {g.selo}</b> · {g.colaborador}
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {g.loja ? `${g.loja} · ` : ''}{dataCal(g.data)}{g.periodoRef ? ` · ref. ${g.periodoRef}` : ''}
                {g.concedidoPor ? ` · por ${g.concedidoPor}` : ''}{g.visto ? ' · visto' : ' · ainda não visto'}
              </div>
            </div>
            <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => remover(g)}>Remover</button>
          </div>
        </div>
      ))}
    </div>
  );
}
