'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const rotulos = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
};

function diasRestantes(prazo) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo) - new Date()) / (1000 * 60 * 60 * 24));
}

const FILTROS = [
  { chave: 'todas', label: 'Todas' },
  { chave: 'sem_resposta', label: 'Sem resposta do RH' },
  { chave: 'no_prazo', label: 'No prazo' },
  { chave: 'atrasadas', label: 'Atrasadas' },
  { chave: 'aguardando_colaborador', label: 'Aguardando colaborador' },
  { chave: 'encerradas', label: 'Encerradas' },
];

export default function AdminPainel() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    fetch('/api/solicitacoes').then((r) => r.json()).then(setSolicitacoes);
  }, []);

  const filtradas = solicitacoes.filter((s) => {
    const dias = diasRestantes(s.prazo);
    switch (filtro) {
      case 'sem_resposta': return s.status === 'aberta' || s.status === 'em_analise';
      case 'no_prazo': return s.status !== 'encerrada' && dias !== null && dias >= 0;
      case 'atrasadas': return s.status !== 'encerrada' && dias !== null && dias < 0;
      case 'aguardando_colaborador': return s.status === 'respondida';
      case 'encerradas': return s.status === 'encerrada';
      default: return true;
    }
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Painel RH / DP</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/colaboradores"><button className="secundario">Colaboradores</button></Link>
          <Link href="/admin/comunicados"><button className="secundario">Enviar comunicado</button></Link>
          <Link href="/admin/assuntos"><button className="secundario">Assuntos</button></Link>
        </div>
      </div>

      <div className="filtros-status">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            className={filtro === f.chave ? 'ativo' : ''}
            onClick={() => setFiltro(f.chave)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtradas.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhuma solicitação nesse filtro.</p>}

      {filtradas.map((s) => {
        const dias = diasRestantes(s.prazo);
        return (
          <Link key={s.id} href={`/admin/solicitacao/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span className="numero-solicitacao">#{s.numero} · </span>
                  <b>{s.assunto.nome}</b>
                </div>
                <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {s.colaborador.nome} · {s.colaborador.loja}
              </p>
              {s.status !== 'encerrada' && dias !== null && (
                <span style={{ fontSize: 12, color: dias < 0 ? 'var(--danger)' : dias <= 1 ? 'var(--warning)' : 'var(--muted)' }}>
                  {dias < 0 ? 'Atrasada' : dias === 0 ? 'Vence hoje' : `${dias} dias restantes`}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
