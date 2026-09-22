'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function NavColaborador() {
  const pathname = usePathname();
  const router = useRouter();
  const [naoLidos, setNaoLidos] = useState([]);
  const [naoVistasCount, setNaoVistasCount] = useState(0);
  const [docsNaoVistosCount, setDocsNaoVistosCount] = useState(0);
  const links = [
    { href: '/perfil', label: 'Meu perfil' },
    { href: '/minhas-solicitacoes', label: 'Minhas solicitações' },
    { href: '/nova-solicitacao', label: 'Nova solicitação' },
    { href: '/conteudos', label: 'Conteúdos' },
    { href: '/documentos', label: 'Documentos' },
  ];

  useEffect(() => {
    fetch('/api/comunicados')
      .then((r) => r.json())
      .then((lista) => setNaoLidos((lista || []).filter((c) => !c.lido)));
    fetch('/api/solicitacoes/nao-vistas')
      .then((r) => r.json())
      .then((d) => setNaoVistasCount(d.count || 0));
    fetch('/api/documentos/nao-vistas')
      .then((r) => r.json())
      .then((d) => setDocsNaoVistosCount(d.count || 0));
  }, []);

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function marcarLido() {
    const atual = naoLidos[0];
    await fetch(`/api/comunicados/${atual.id}/lido`, { method: 'POST' });
    setNaoLidos(naoLidos.slice(1));
  }

  return (
    <div>
      {naoLidos.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Comunicado do RH</div>
            <h3 style={{ marginTop: 0 }}>{naoLidos[0].assunto}</h3>
            <p style={{ fontSize: 14 }}>{naoLidos[0].texto}</p>
            {naoLidos[0].anexos?.map((a) => (
              <div key={a.id} style={{ marginBottom: 6 }}>
                <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
              </div>
            ))}
            <button onClick={marcarLido} style={{ marginTop: 8 }}>OK, entendi</button>
            {naoLidos.length > 1 && (
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                +{naoLidos.length - 1} comunicado(s) depois deste
              </span>
            )}
          </div>
        </div>
      )}

      <div className="topo-marca">
        <button className="secundario botao-sair" onClick={sair} style={{ padding: '4px 12px', fontSize: 13 }}>Sair</button>
        <Link href="/inicio">
          <img src="/logo.png" alt="Logo" />
        </Link>
        <div className="titulo-portal">Portal do Colaborador</div>
      </div>
      <div className="nav-colaborador">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? 'ativo' : ''}>
            {l.label}
            {l.href === '/minhas-solicitacoes' && naoVistasCount > 0 && (
              <span className="bolinha-notificacao">{naoVistasCount}</span>
            )}
            {l.href === '/documentos' && docsNaoVistosCount > 0 && (
              <span className="bolinha-notificacao">{docsNaoVistosCount}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
