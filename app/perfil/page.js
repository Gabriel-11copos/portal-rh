'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import UploadAnexo from '../components/UploadAnexo';

// Converte o link de visualização do Drive num link direto de imagem (pra usar em <img>).
// O endpoint de "thumbnail" é mais confiável para isso do que o "uc?export=view".
function fotoDireta(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([^/]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : link;
}

export default function MeuPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [nomeSocial, setNomeSocial] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [fotoComErro, setFotoComErro] = useState(false);

  function carregar() {
    fetch('/api/perfil').then((r) => r.json()).then((p) => {
      setPerfil(p);
      setNomeSocial(p.nomeSocial || '');
    });
  }

  useEffect(carregar, []);

  async function salvarNomeSocial(e) {
    e.preventDefault();
    setSalvando(true);
    await fetch('/api/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeSocial }),
    });
    setSalvando(false);
    setMsg('Nome social atualizado!');
    carregar();
  }

  async function salvarFoto(anexo) {
    setFotoComErro(false);
    await fetch('/api/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fotoUrl: anexo.link }),
    });
    carregar();
  }

  if (!perfil) return <p>Carregando...</p>;

  const admissao = perfil.dataAdmissao
    ? new Date(perfil.dataAdmissao).toLocaleDateString('pt-BR')
    : '-';
  const nomeExibido = perfil.nomeSocial || perfil.nome;
  const fotoSrc = fotoDireta(perfil.fotoUrl);

  return (
    <div>
      <NavColaborador />
      <h2>Meu perfil</h2>

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--verde-pastel)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--verde)',
            flexShrink: 0,
          }}
        >
          {fotoSrc && !fotoComErro ? (
            <img
              src={fotoSrc}
              alt="Foto de perfil"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setFotoComErro(true)}
            />
          ) : (
            nomeExibido.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{nomeExibido}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>{perfil.cargo || '-'} · {perfil.loja}</div>
        </div>
      </div>

      <div className="card">
        <label>Trocar foto de perfil</label>
        <UploadAnexo onUploaded={salvarFoto} />
      </div>

      <div className="card">
        <p><label>Nome (CPF/cadastro)</label>{perfil.nome}</p>
        <p><label>Cargo</label>{perfil.cargo || '-'}</p>
        <p><label>Loja</label>{perfil.loja}</p>
        <p><label>Data de admissão</label>{admissao}</p>
        <p><label>E-mail</label>{perfil.email}</p>
        <p><label>CPF (login)</label>{perfil.matricula}</p>
      </div>

      <div className="card">
        <h3>Nome social</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Se preenchido, esse é o nome que vai aparecer para você e para o RH em todo o sistema.
        </p>
        <form onSubmit={salvarNomeSocial}>
          <input
            value={nomeSocial}
            onChange={(e) => setNomeSocial(e.target.value)}
            placeholder="Deixe em branco para usar o nome do cadastro"
          />
          <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </form>
        {msg && <p style={{ fontSize: 13, color: 'var(--success)' }}>{msg}</p>}
      </div>
    </div>
  );
}
