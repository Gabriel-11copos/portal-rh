'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavColaborador from '../../components/NavColaborador';
import BotaoVoltar from '../../components/BotaoVoltar';
import V from '../../../lib/vt';

// "Meus benefícios": hoje só o vale-transporte, mas a página já está pronta para receber outros.
export default function Beneficios() {
  const router = useRouter();
  const [vt, setVt] = useState(undefined);

  useEffect(() => {
    fetch('/api/vt').then((r) => (r.ok ? r.json() : null)).then((j) => setVt(j)).catch(() => setVt(null));
  }, []);

  let resumo = 'Informe como você vai para o trabalho.';
  let selo = null;
  if (vt === undefined) resumo = 'Carregando...';
  else if (!vt || !vt.disponivel) resumo = 'Em breve.';
  else if (vt.pendencia) { resumo = vt.pendencia === 'primeiro' ? 'Falta informar o seu transporte.' : 'O RH pediu para você atualizar o seu transporte.'; selo = <span className="badge aberta">Pendente</span>; }
  else if (vt.usaVT === false) resumo = 'Você declarou que não utiliza vale-transporte.';
  else if (vt.mapeado) resumo = `${V.MODALIDADES[vt.modalidade] || ''}${vt.valores && vt.valores.dia ? ` · ${V.reais(vt.valores.dia)} por dia` : ''}`;
  if (vt && vt.saldo && !vt.saldo.respondido) { resumo = vt.saldo.status === 'refazer' ? 'O RH pediu para você enviar o saldo de novo.' : 'Falta informar o saldo do seu cartão.'; selo = <span className="badge aberta">Pendente</span>; }

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Meus benefícios</h2>
      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer' }} onClick={() => router.push('/perfil/beneficios/vale-transporte')} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') router.push('/perfil/beneficios/vale-transporte'); }}>
        <div style={{ fontSize: 30 }} aria-hidden="true">🚌</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>Vale-transporte</h3>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{resumo}</div>
        </div>
        {selo}
        <span aria-hidden="true">›</span>
      </div>
    </div>
  );
}
