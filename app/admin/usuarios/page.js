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
  const [msgLista, setMsgLista] = useState('');          // avisos das ações da lista (excluir, alterar senha)
  const [senhaDe, setSenhaDe] = useState(null);          // id do usuário cuja senha o master está trocando
  const [novaSenha, setNovaSenha] = useState('');
  const [trocandoMinha, setTrocandoMinha] = useState(false);
  const [minha, setMinha] = useState({ atual: '', nova: '', repetir: '' });
  const [msgPerfil, setMsgPerfil] = useState('');

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
    setMsgLista('');
    const res = await fetch(`/api/admin-usuarios/${u.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setMsgLista(res.ok ? `Usuário ${u.nome} excluído.` : (data.erro || 'Não foi possível excluir.'));
    carregar();
  }

  function erroDaSenha(s) {
    if (!s || !s.trim()) return 'Digite a nova senha.';
    if (s.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (s.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
    return '';
  }

  // uma senha provisória fácil de ler e de ditar (sem letras que se confundem: l, o, 0, 1)
  function gerarSenha() {
    const letras = 'abcdefghijkmnpqrstuvwxyz23456789';
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) { setMsgLista('Este navegador não consegue gerar a senha. Digite uma.'); return; }
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    setNovaSenha(Array.from(bytes).map((b) => letras[b % letras.length]).join(''));
  }

  // o master define uma nova senha para quem esqueceu
  async function salvarSenhaDe(u) {
    setMsgLista('');
    const erro = erroDaSenha(novaSenha);
    if (erro) { setMsgLista(erro); return; }
    const res = await fetch(`/api/admin-usuarios/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novaSenha }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsgLista(`Senha de ${u.nome} alterada. Passe a nova senha para a pessoa.`);
      setSenhaDe(null);
      setNovaSenha('');
    } else {
      setMsgLista(data.erro || 'Não foi possível alterar a senha.');
    }
  }

  // cada um troca a PRÓPRIA senha (pede a atual)
  async function salvarMinhaSenha() {
    setMsgPerfil('');
    if (!minha.atual) { setMsgPerfil('Digite a senha atual.'); return; }
    const erro = erroDaSenha(minha.nova);
    if (erro) { setMsgPerfil(erro); return; }
    if (minha.nova !== minha.repetir) { setMsgPerfil('As duas senhas novas não são iguais.'); return; }
    const res = await fetch('/api/admin-usuarios/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senhaAtual: minha.atual, novaSenha: minha.nova }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsgPerfil('Senha alterada!');
      setTrocandoMinha(false);
      setMinha({ atual: '', nova: '', repetir: '' });
    } else {
      setMsgPerfil(data.erro || 'Não foi possível alterar a senha.');
    }
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
            <div style={{ marginTop: 8 }}>
              {!trocandoMinha ? (
                <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { setTrocandoMinha(true); setMsgPerfil(''); }}>Alterar minha senha</button>
              ) : (
                <div style={{ maxWidth: 320 }}>
                  <label>Senha atual</label>
                  <input type="password" value={minha.atual} onChange={(e) => setMinha({ ...minha, atual: e.target.value })} autoComplete="current-password" />
                  <label>Nova senha (mínimo 6 caracteres)</label>
                  <input type="password" value={minha.nova} onChange={(e) => setMinha({ ...minha, nova: e.target.value })} autoComplete="new-password" />
                  <label>Repita a nova senha</label>
                  <input type="password" value={minha.repetir} onChange={(e) => setMinha({ ...minha, repetir: e.target.value })} autoComplete="new-password" />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={salvarMinhaSenha}>Salvar senha</button>
                    <button type="button" className="secundario" onClick={() => { setTrocandoMinha(false); setMinha({ atual: '', nova: '', repetir: '' }); setMsgPerfil(''); }}>Cancelar</button>
                  </div>
                </div>
              )}
              {msgPerfil && <p style={{ fontSize: 13, margin: '8px 0 0' }}>{msgPerfil}</p>}
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
        {msgLista && <p style={{ fontSize: 13 }}>{msgLista}</p>}
        {usuarios.map((u) => {
          const euMesmo = meuPerfil && u.id === meuPerfil.id;
          return (
            <div key={u.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar fotoUrl={u.fotoUrl} nome={u.nome} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}{euMesmo && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (você)</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
                </div>
                {!euMesmo && (
                  <>
                    <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { setSenhaDe(senhaDe === u.id ? null : u.id); setNovaSenha(''); setMsgLista(''); }}>Alterar senha</button>
                    <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12, color: 'var(--danger)' }} onClick={() => excluir(u)}>Excluir</button>
                  </>
                )}
              </div>
              {senhaDe === u.id && (
                <div style={{ marginTop: 8, marginLeft: 42, maxWidth: 360 }}>
                  <label>Nova senha para {u.nome} (mínimo 6 caracteres)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="off" />
                    <button type="button" className="secundario" style={{ whiteSpace: 'nowrap' }} onClick={gerarSenha}>Gerar senha</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => salvarSenhaDe(u)}>Salvar nova senha</button>
                    <button type="button" className="secundario" onClick={() => { setSenhaDe(null); setNovaSenha(''); }}>Cancelar</button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>A senha só aparece aqui, para você passar para a pessoa. Depois de salvar, ela entra com a nova.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}
