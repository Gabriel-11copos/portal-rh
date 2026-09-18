'use client';
import { useEffect, useState } from 'react';

export default function CadastrarColaboradores() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nome: '', matricula: '', email: '', loja: '', senha: '' });
  const [msg, setMsg] = useState('');

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
      setMsg('Colaborador cadastrado!');
      setForm({ nome: '', matricula: '', email: '', loja: '', senha: '' });
      carregar();
    } else {
      const data = await res.json();
      setMsg(data.erro || 'Erro ao cadastrar.');
    }
  }

  return (
    <div>
      <h2>Cadastrar colaboradores</h2>
      <div className="card">
        <form onSubmit={cadastrar}>
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <label>Matrícula</label>
          <input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} required />
          <label>E-mail</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <label>Loja</label>
          <input value={form.loja} onChange={(e) => setForm({ ...form, loja: e.target.value })} required />
          <label>Senha inicial</label>
          <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
          <button type="submit">Cadastrar</button>
        </form>
        {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      </div>

      {lista.map((c) => (
        <div key={c.id} className="card">
          {c.nome} · {c.matricula} · {c.loja}
        </div>
      ))}
    </div>
  );
}
