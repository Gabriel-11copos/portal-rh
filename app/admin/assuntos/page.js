'use client';
import { useEffect, useState } from 'react';

export default function GerenciarAssuntos() {
  const [assuntos, setAssuntos] = useState([]);
  const [nome, setNome] = useState('');
  const [prazoPadraoDias, setPrazo] = useState(5);
  const [responsavelPadrao, setResponsavel] = useState('');
  const [respostaAutomatica, setResposta] = useState('');

  function carregar() {
    fetch('/api/assuntos').then((r) => r.json()).then(setAssuntos);
  }

  useEffect(carregar, []);

  async function criar(e) {
    e.preventDefault();
    await fetch('/api/assuntos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        prazoPadraoDias: Number(prazoPadraoDias),
        responsavelPadrao,
        respostaAutomatica: respostaAutomatica || null,
      }),
    });
    setNome(''); setResponsavel(''); setResposta('');
    carregar();
  }

  return (
    <div>
      <h2>Assuntos (RH e DP)</h2>

      <div className="card">
        <h3>Novo assunto</h3>
        <form onSubmit={criar}>
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />

          <label>Prazo padrão (dias úteis)</label>
          <input type="number" value={prazoPadraoDias} onChange={(e) => setPrazo(e.target.value)} required />

          <label>Responsável padrão (ex: RH, DP, Financeiro)</label>
          <input value={responsavelPadrao} onChange={(e) => setResponsavel(e.target.value)} />

          <label>Resposta automática (opcional — se preenchido, responde sozinho na hora)</label>
          <textarea rows={3} value={respostaAutomatica} onChange={(e) => setResposta(e.target.value)} />

          <button type="submit">Cadastrar assunto</button>
        </form>
      </div>

      {assuntos.map((a) => (
        <div key={a.id} className="card">
          <b>{a.nome}</b> · prazo: {a.prazoPadraoDias} dias · responsável: {a.responsavelPadrao || '-'}
          {a.respostaAutomatica && <p style={{ fontSize: 13, color: 'var(--success)' }}>✓ Resposta automática configurada</p>}
        </div>
      ))}
    </div>
  );
}
