'use client';

// O ícone de um selo pode ser um emoji ou uma imagem enviada para o portal (guardada como /api/guias/midia/<id>).
export const PREFIXO_IMAGEM = '/api/guias/midia/';

export function ehImagemDeSelo(icone) {
  return typeof icone === 'string' && icone.startsWith(PREFIXO_IMAGEM);
}

export default function IconeSelo({ icone, tamanho = 28 }) {
  if (ehImagemDeSelo(icone)) {
    return <img src={icone} alt="" style={{ width: tamanho, height: tamanho, objectFit: 'contain', verticalAlign: 'middle' }} />;
  }
  return <span style={{ fontSize: tamanho, lineHeight: 1 }}>{icone}</span>;
}
