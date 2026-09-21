'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavColaborador from '../components/NavColaborador';
import Avatar from '../components/Avatar';

export default function Inicio() {
  const [perfil, setPerfil] = useState(null);
  const [comunicados, setComunicados] = useState([]);
  const [naoVistasCount, setNaoVistasCount] = useState(0);
  const [abrirSolicitacoes, setAbrirSolicitacoes] = useState(false);
  const [abrirComunicados, setAbrirComunicados] = useState(false);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then(setPerfil);
    fetch('/api/comunicados').then((r) => r.json()).then(setComunicados);
    fetch('/api/solicitacoes/nao-vistas').then((r) => r.json()).then((d) => setNaoVistasCount(d.count || 0));
  }, []);

  if (!perfil) {
    return (
      <div>
        <NavColaborador />
        <p>Carregando...</p>
      </div>
    );
  }

  const nomeExibido = perfil.nomeSocial || perfil.nome;
  const naoLidosCount = comunicados.filter((c) => !c.lido).length;

  return (
    <div>
      <NavColaborador />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ width: 220, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Avatar fotoUrl={perfil.fotoUrl} nome={nomeExibido} size={72} />
          </div>
          <div style={{ fontWeight: 700 }}>{nomeExibido}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{perfil.cargo || '-'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{perfil.loja}</div>
          <Link href="/perfil">
            <button className="secundario" style={{ marginTop: 12, width: '100%' }}>Ver perfil completo</button>
          </Link>
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="card">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setAbrirSolicitacoes(!abrirSolicitacoes)}
            >
              <h3 style={{ margin: 0 }}>
                Solicitações
                {naoVistasCount > 0 && <span className="bolinha-notificacao">{naoVistasCount}</span>}
              </h3>
              <span style={{ color: 'var(--muted)' }}>{abrirSolicitacoes ? '▲' : '▼'}</span>
            </div>
            {abrirSolicitacoes && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Link href="/minhas-solicitacoes"><button>Minhas solicitações</button></Link>
                <Link href="/nova-solicitacao"><button className="secundario">Enviar solicitação</button></Link>
              </div>
            )}
          </div>

          <div className="card">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setAbrirComunicados(!abrirComunicados)}
            >
              <h3 style={{ margin: 0 }}>
                Comunicados recebidos
                {naoLidosCount > 0 && <span className="badge aberta" style={{ marginLeft: 8 }}>{naoLidosCount} novo(s)</span>}
              </h3>
              <span style={{ color: 'var(--muted)' }}>{abrirComunicados ? '▲' : '▼'}</span>
            </div>
            {abrirComunicados && (
              <div style={{ marginTop: 12 }}>
                {comunicados.length === 0 && (
                  <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nenhum comunicado recebido ainda.</p>
                )}
                {comunicados.map((c) => (
                  <div key={c.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>{c.assunto}</b>
                      {!c.lido && <span className="badge aberta">Novo</span>}
                    </div>
                    <p style={{ fontSize: 14 }}>{c.texto}</p>
                    {c.anexos.map((a) => (
                      <div key={a.id}>
                        <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
