'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [aba, setAba] = useState('colaborador');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    const rota = aba === 'colaborador' ? '/api/auth/colaborador' : '/api/auth/rh';
    const body = aba === 'colaborador' ? { matricula, senha } : { senha };

    const res = await fetch(rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setErro(data.erro || 'Erro ao entrar.');
      return;
    }

    router.push(aba === 'colaborador' ? '/minhas-solicitacoes' : '/admin');
  }

  return (
    <div className="card" style={{ maxWidth: 380, margin: '60px auto' }}>
      <h2>Portal RH & DP</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={aba === 'colaborador' ? '' : 'secundario'}
          onClick={() => setAba('colaborador')}
          type="button"
        >
          Colaborador
        </button>
        <button
          className={aba === 'rh' ? '' : 'secundario'}
          onClick={() => setAba('rh')}
          type="button"
        >
          RH / DP
        </button>
      </div>

      <form onSubmit={entrar}>
        {aba === 'colaborador' && (
          <>
            <label>Matrícula</label>
            <input value={matricula} onChange={(e) => setMatricula(e.target.value)} required />
          </>
        )}
        <label>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <div className="erro">{erro}</div>}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
