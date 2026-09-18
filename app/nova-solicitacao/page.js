'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UploadAnexo from '../components/UploadAnexo';

export default function NovaSolicitacao() {
  const router = useRouter();
  const [assuntos, setAssuntos] = useState([]);
  const [assuntoId, setAssuntoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch('/api/assuntos').then((r) => r.json()).then(setAssuntos);
  }, []);

  async function enviar(e) {
    e.preventDefault();
    const res = await fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assuntoId, descricao, anexos }),
    });
    if (res.ok) setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="card">
        <h2>Solicitação enviada!</h2>
        <p>Você pode acompanhar o status a qualquer momento em "Minhas solicitações".</p>
        <button onClick={() => router.push('/minhas-solicitacoes')}>Ver minhas solicitações</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Nova solicitação</h2>
      <form onSubmit={enviar}>
        <label>Assunto</label>
        <select value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)} required>
          <option value="">Selecione...</option>
          {assuntos.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>

        <label>Descreva sua solicitação</label>
        <textarea rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)} required />

        <UploadAnexo onUploaded={(a) => setAnexos([...anexos, a])} />
        {anexos.map((a, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>
        ))}

        <div style={{ marginTop: 16 }}>
          <button type="submit">Enviar solicitação</button>
        </div>
      </form>
    </div>
  );
}
