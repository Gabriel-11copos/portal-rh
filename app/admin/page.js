'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const rotulos = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
};

function statusPrazo(prazo) {
  if (!prazo) return null;
  const dias = Math.ceil((new Date(prazo) - new Date()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { texto: 'Atrasada', cor: 'var(--danger)' };
  if (dias <= 1) return { texto: 'Vence hoje/amanhã', cor: 'var(--warning)' };
  return { texto: `${dias} dias restantes`, cor: 'var(--muted)' };
}

export default function AdminPainel() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    const url = filtro ? `/api/solicitacoes?status=${filtro}` : '/api/solicitacoes';
    fetch(url).then((r) => r.json()).then(setSolicitacoes);
  }, [filtro]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Painel RH / DP</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/comunicados"><button className="secundario">Enviar comunicado</button></Link>
          <Link href="/admin/assuntos"><button className="secundario">Assuntos</button></Link>
        </div>
      </div>

      <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 220 }}>
        <option value="">Todos os status</option>
        <option value="aberta">Aberta</option>
        <option value="em_analise">Em análise</option>
        <option value="respondida">Respondida</option>
        <option value="encerrada">Encerrada</option>
      </select>

      {solicitacoes.map((s) => {
        const prazoInfo = statusPrazo(s.prazo);
        return (
          <Link key={s.id} href={`/admin/solicitacao/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{s.assunto.nome}</b>
                <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {s.colaborador.nome} · {s.colaborador.loja}
              </p>
              {prazoInfo && s.status !== 'encerrada' && (
                <span style={{ fontSize: 12, color: prazoInfo.cor }}>{prazoInfo.texto}</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
