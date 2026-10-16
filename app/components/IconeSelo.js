'use client';
import { useState } from 'react';

// O ícone de um selo pode ser:
//  - um emoji;
//  - uma imagem enviada para o portal (guardada como /api/guias/midia/<id>);
//  - uma arte guardada no projeto (ex: /selos/tempo-3m.png), passada em "imagem". Se o arquivo não
//    carregar, aparece o emoji, nunca uma imagem quebrada.
export const PREFIXO_IMAGEM = '/api/guias/midia/';

export function ehImagemDeSelo(icone) {
  return typeof icone === 'string' && icone.startsWith(PREFIXO_IMAGEM);
}

export default function IconeSelo({ icone, imagem, tamanho = 28 }) {
  const [falhou, setFalhou] = useState(false);
  const src = ehImagemDeSelo(icone) ? icone : (imagem && !falhou ? imagem : null);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        onError={() => { if (src === imagem) setFalhou(true); }}
        style={{ width: tamanho, height: tamanho, objectFit: 'contain', verticalAlign: 'middle' }}
      />
    );
  }
  return <span style={{ fontSize: tamanho, lineHeight: 1 }}>{icone}</span>;
}
