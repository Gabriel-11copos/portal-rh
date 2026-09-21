'use client';
import { useState } from 'react';

// Converte o link de visualização do Drive num link direto de imagem.
export function fotoDireta(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([^/]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w200` : link;
}

// Mostra a foto de perfil da pessoa; se não tiver foto (ou falhar ao carregar),
// mostra a primeira letra do nome como ícone.
export default function Avatar({ fotoUrl, nome, size = 32 }) {
  const [erro, setErro] = useState(false);
  const src = fotoDireta(fotoUrl);
  const inicial = (nome || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'var(--verde-pastel)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42, fontWeight: 700, color: 'var(--verde)',
      }}
    >
      {src && !erro ? (
        <img
          src={src}
          alt={nome}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setErro(true)}
        />
      ) : (
        inicial
      )}
    </div>
  );
}
