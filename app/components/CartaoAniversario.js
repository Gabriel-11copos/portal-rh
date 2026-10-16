'use client';
import { useEffect, useState } from 'react';

// Cartão da tela inicial. Só aparece no dia do aniversário de quem está logado.
export default function CartaoAniversario() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    fetch('/api/aniversario')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info || !info.aniversario) return null;

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 10px' }}>Feliz aniversário{info.nome ? `, ${info.nome}` : ''}! 🎂</h3>
      <img
        src={info.cartao}
        alt="Cartão de aniversário"
        style={{ width: '100%', maxWidth: 340, borderRadius: 16 }}
      />
    </div>
  );
}
