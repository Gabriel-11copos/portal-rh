// O símbolo da moeda do Brew: o desenho da tampinha dourada (public/moeda.png), que aparece em qualquer aparelho.
// O RH pode escolher outro símbolo (um emoji) no painel; "moeda" (ou vazio) significa "usar o desenho".
// "🪙" também mostra o desenho: o emoji é recente e some em aparelhos e navegadores mais antigos.
export function usaDesenho(simbolo) {
  return !simbolo || simbolo === 'moeda' || simbolo === '🪙';
}

export default function IconeMoeda({ simbolo = 'moeda', tamanho = 18 }) {
  if (usaDesenho(simbolo)) {
    return <img src="/moeda.png" alt="" aria-hidden="true" width={tamanho} height={tamanho} style={{ width: tamanho, height: tamanho, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />;
  }
  return <span aria-hidden="true" style={{ fontSize: tamanho * 0.9, lineHeight: 1, verticalAlign: 'middle' }}>{simbolo}</span>;
}
