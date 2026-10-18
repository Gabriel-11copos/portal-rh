import { NextResponse } from 'next/server';

// Anota em cada pedido ao painel e à API qual é o caminho e o método REAIS, sempre sobrescrevendo qualquer
// valor que o navegador tenha enviado com esses nomes. É com isso que o sistema sabe o que está sendo
// acessado e confere as permissões de cada usuário do RH (veja lib/permissoes.js).
export function middleware(req) {
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set('x-pathname', req.nextUrl.pathname);
  cabecalhos.set('x-metodo', req.method);
  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = { matcher: ['/api/:path*', '/admin/:path*'] };
