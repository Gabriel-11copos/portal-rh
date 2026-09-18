'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import UploadAnexo from '../../components/UploadAnexo';

export default function EnviarComunicado() {
  const router = useRouter();
  const [modo, setModo] = useState('matricula'); // matricula | loja
  const [valor, setValor] = useState('');
  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const body = { assunto, texto, anexos };
    if (modo === 'matricula') body.colaboradorId = valor;
    else body.loja = valor;

    const res = await fetch('/api/comunicados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="card">
        <h2>Comunicado enviado!</h2>
        <button onClick={() => router.push('/admin')}>Voltar ao painel</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Enviar comunicado</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Nota: aqui o campo abaixo aceita o ID do colaborador. Se quiser buscar por nome/matrícula
        numa lista, dá pra evoluir essa tela depois.
      </p>
      <form onSubmit={enviar}>
        <label>Enviar para</label>
        <select value={modo} onChange={(e) => setModo(e.target.value)}>
          <option value="matricula">Um colaborador (ID)</option>
          <option value="loja">Uma loja inteira</option>
        </select>

        <label>{modo === 'matricula' ? 'ID do colaborador' : 'Nome da loja'}</label>
        <input value={valor} onChange={(e) => setValor(e.target.value)} required />

        <label>Assunto</label>
        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} required />

        <label>Mensagem</label>
        <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} required />

        <UploadAnexo onUploaded={(a) => setAnexos([...anexos, a])} />
        {anexos.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>)}

        <button type="submit" style={{ marginTop: 12 }}>Enviar</button>
      </form>
    </div>
  );
}
