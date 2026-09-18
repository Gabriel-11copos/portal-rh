'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavColaborador() {
  const pathname = usePathname();
  const links = [
    { href: '/minhas-solicitacoes', label: 'Minhas solicitações' },
    { href: '/nova-solicitacao', label: 'Nova solicitação' },
    { href: '/perfil', label: 'Meu perfil' },
  ];

  return (
    <div>
      <div className="topo-marca">
        <img src="/logo.png" alt="Logo" />
        <span>Portal RH & DP</span>
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
