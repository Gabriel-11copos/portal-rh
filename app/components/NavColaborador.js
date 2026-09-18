'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function NavColaborador() {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: '/minhas-solicitacoes', label: 'Minhas solicitações' },
    { href: '/nova-solicitacao', label: 'Nova solicitação' },
    { href: '/perfil', label: 'Meu perfil' },
  ];

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div>
      <div className="topo-marca" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Logo" />
          <span>Portal RH & DP</span>
        </div>
        <button className="secundario" onClick={sair} style={{ padding: '4px 12px', fontSize: 13 }}>Sair</button>
      </div>
      <div className="nav-colaborador">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? 'ativo' : ''}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
