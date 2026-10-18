import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

const { getSessaoRHBruta, sessaoRHAntiga } = require('../../lib/auth');
const { permitido } = require('../../lib/permissoes');

// Protege todas as telas do painel do RH. Quem não tem permissão para a tela que abriu vê um aviso (e não a tela).
// A proteção de verdade dos DADOS está nas rotas da API (veja lib/auth.js); isto é o que evita a pessoa ver uma tela vazia ou com erros.
export default function LayoutDoPainel({ children }) {
  // sessão de antes das permissões: é só entrar de novo (uma única vez)
  if (sessaoRHAntiga()) redirect('/login');

  const sessao = getSessaoRHBruta();
  if (!sessao) return <>{children}</>;           // sem sessão: as telas tratam como sempre trataram (levam ao login)

  let caminho = '';
  try { caminho = headers().get('x-pathname') || ''; } catch { /* fora de uma requisição */ }
  // sem saber o caminho, não bloqueia a tela (a API continua barrando o que não for permitido)
  if (!caminho || permitido(sessao, caminho, 'GET')) return <>{children}</>;

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h2>Você não tem permissão para esta área</h2>
      <p style={{ color: '#6b7280' }}>Se você precisa dela, peça a quem administra o portal para liberar o seu acesso.</p>
      <a href="/admin">Voltar ao menu</a>
    </div>
  );
}
