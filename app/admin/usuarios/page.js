'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';
import UploadAnexo from '../../components/UploadAnexo';
import Avatar from '../../components/Avatar';

export default function UsuariosRH() {
  const [usuarios, setUsuarios] = useState(null);   // null = quem está logado não pode gerenciar usuários (só o master pode)
  const [meuPerfil, setMeuPerfil] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [msg, setMsg] = useState('');

  function carregar() {
    fetch('/api/admin-usuarios').then((r) => r.json()).then((d) => setUsuarios(Array.isArray(d) ? d : null)).catch(() => setUsuarios(null));
    fetch('/api/admin-usuarios/perfil').then((r) => r.json()).then(setMeuPerfil);
  }
  useEffect(carregar, []);

  async function criar(e) {
    e.preventDefault();
    const res = await fetch('/api/admin-usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setMsg('Usuário criado!');
      setForm({ nome: '', email: '', senha: '' });
      carregar();
    } else {
      const data = await res.json();
      setMsg(data.erro || 'Erro ao criar usuário.');
    }
  }

  async function excluir(u) {
    if (!window.confirm(`Excluir o usuário ${u.nome}? Ele deixa de poder entrar no painel e sai dos assuntos que atendia. O nome dele continua nas respostas que já deu.`)) return;
    setMsg('');
    const res = await fetch(`/api/admin-usuarios/${u.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Usuário ${u.nome} excluído.` : (data.erro || 'Não foi possível excluir.'));
    carregar();
  }

  async function trocarMinhaFoto(anexo) {
    await fetch('/api/admin-usuarios/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fotoUrl: anexo.link }),
    });
    carregar();
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>{usuarios ? 'Meu perfil e usuários do RH/DP' : 'Meu perfil'}</h2>

      {meuPerfil && (
        <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Avatar fotoUrl={meuPerfil.fotoUrl} nome={meuPerfil.nome} size={64} />
          <div>
            <div style={{ fontWeight: 700 }}>{meuPerfil.nome}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{meuPerfil.email}</div>
            <div style={{ marginTop: 8 }}>
              <UploadAnexo label="Trocar minha foto" onUploaded={trocarMinhaFoto} />
            </div>
          </div>
        </div>
      )}

      {usuarios && (<>
      <div className="card">
        <h3>Novo usuário do RH/DP</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Ex: crie um acesso próprio para a Dani, com o nome e a senha que ela vai usar.
        </p>
        <form onSubmit={criar}>
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <label>E-mail (login)</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <label>Senha</label>
          <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
          <button type="submit">Criar usuário</button>
        </form>
        {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      </div>

      <div className="card">
        <h3>Usuários com acesso ao RH/DP</h3>
        {usuarios.map((u) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <Avatar fotoUrl={u.fotoUrl} nome={u.nome} size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}{meuPerfil && u.id === meuPerfil.id && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (você)</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
            </div>
            {!(meuPerfil && u.id === meuPerfil.id) && (
              <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12, color: 'var(--danger)' }} onClick={() => excluir(u)}>Excluir</button>
            )}
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
