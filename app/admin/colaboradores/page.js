'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../components/BotaoVoltar';

const ROTULOS_HISTORICO = {
  admissao: 'Admissão',
  transferencia: 'Transferência',
  mudanca_cargo: 'Mudança de cargo',
  inativacao: 'Inativação',
  reativacao: 'Reativação',
};

// Datas só de calendário (nascimento, admissão) são guardadas à meia-noite UTC;
// ler em UTC evita que apareçam com um dia a menos no horário de Brasília.
function dataCalendario(valor) {
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function CadastrarColaboradores() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nome: '', matricula: '', email: '', loja: '', cargo: '', dataAdmissao: '' });
  const [msg, setMsg] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [busca, setBusca] = useState('');
  const [abertoId, setAbertoId] = useState(null);
  const [historico, setHistorico] = useState([]);

  function carregar() {
    fetch('/api/colaboradores').then((r) => r.json()).then(setLista);
  }
  useEffect(carregar, []);

  async function cadastrar(e) {
    e.preventDefault();
    const res = await fetch('/api/colaboradores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setMsg('Colaborador cadastrado! Senha inicial = 6 primeiros dígitos do CPF.');
      setForm({ nome: '', matricula: '', email: '', loja: '', cargo: '', dataAdmissao: '' });
      carregar();
    } else {
      const data = await res.json();
      setMsg(data.erro || 'Erro ao cadastrar.');
    }
  }

  async function alternarAtivo(colaborador) {
    await fetch(`/api/colaboradores/${colaborador.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !colaborador.ativo }),
    });
    setAbertoId(null);
    carregar();
  }

  async function alternarHistorico(colaborador) {
    if (abertoId === colaborador.id) {
      setAbertoId(null);
      return;
    }
    const res = await fetch(`/api/colaboradores/${colaborador.id}`);
    const dados = await res.json();
    setHistorico(Array.isArray(dados) ? dados : []);
    setAbertoId(colaborador.id);
  }

  const termo = busca.trim().toLowerCase();
  const listaFiltrada = lista
    .filter((c) => mostrarInativos || c.ativo)
    .filter((c) => !termo || (c.nomeSocial || c.nome).toLowerCase().includes(termo) || c.matricula.includes(termo));

  return (
    <div>
      <BotaoVoltar />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Colaboradores</h2>
        <Link href="/admin/colaboradores/importar"><button className="secundario">Importar lista de ativos</button></Link>
        <a href="/api/colaboradores/exportar" download><button type="button" className="secundario">⬇ Exportar base de ativos (com celular)</button></a>
      </div>

      <div className="card">
        <h3>Cadastro manual (um por vez)</h3>
        <form onSubmit={cadastrar}>
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <label>CPF (login — apenas números)</label>
          <input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} required />
          <label>E-mail</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <label>Loja</label>
          <input value={form.loja} onChange={(e) => setForm({ ...form, loja: e.target.value })} required />
          <label>Cargo</label>
          <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          <label>Data de admissão</label>
          <input type="date" value={form.dataAdmissao} onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })} />
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            A senha inicial é gerada automaticamente: os 6 primeiros dígitos do CPF.
          </p>
          <button type="submit">Cadastrar</button>
        </form>
        {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ maxWidth: 300, marginBottom: 0 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
          Mostrar inativos também
        </label>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{listaFiltrada.length} pessoa(s)</span>
      </div>

      {listaFiltrada.map((c) => (
        <div key={c.id} className="card" style={{ opacity: c.ativo ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <b>{c.nomeSocial || c.nome}</b> {!c.ativo && <span className="badge encerrada">Inativo</span>}
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {c.matricula} · {c.loja} {c.cargo && `· ${c.cargo}`}
                {c.dataNascimento && ` · Nasc.: ${dataCalendario(c.dataNascimento)}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => alternarHistorico(c)}>
                {abertoId === c.id ? 'Fechar histórico' : 'Histórico'}
              </button>
              <button className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => alternarAtivo(c)}>
                {c.ativo ? 'Inativar' : 'Reativar'}
              </button>
            </div>
          </div>

          {abertoId === c.id && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {historico.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  Nenhuma movimentação registrada ainda. O histórico começa a partir da próxima importação ou alteração.
                </p>
              )}
              {historico.map((h) => (
                <div key={h.id} style={{ fontSize: 13, padding: '4px 0' }}>
                  <b>{ROTULOS_HISTORICO[h.tipo] || h.tipo}</b>
                  {h.de || h.para ? ` — ${h.de || '—'} → ${h.para || '—'}` : ''}
                  <span style={{ color: 'var(--muted)' }}>
                    {' '}· {new Date(h.data).toLocaleString('pt-BR')} · {h.origem === 'importacao' ? 'importação' : 'manual'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
