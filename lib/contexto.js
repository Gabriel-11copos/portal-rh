// Uma mesma pessoa pode ter os DOIS logins no mesmo navegador (quem é do RH e também é colaborador).
// Nas rotas que atendem os dois lados, a resposta tem que depender da TELA que está pedindo,
// e não de qual login existe: nas telas do painel (/admin) vale o login do RH;
// em todas as outras (as do colaborador) vale o login do colaborador, e só o que é dele.

// O endereço da tela que fez o pedido (o navegador manda sozinho em chamadas do próprio site).
function paginaDeOrigem(req) {
  try {
    if (!req || !req.headers || typeof req.headers.get !== 'function') return null;
    const ref = req.headers.get('referer');
    if (!ref) return null;
    const url = new URL(ref);
    // só vale se a tela é deste mesmo site (e não de um endereço qualquer com /admin no caminho)
    const host = req.headers.get('host');
    if (host && url.host !== host) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function veioDoPainel(req) {
  const p = paginaDeOrigem(req);
  return !!p && (p === '/admin' || p.startsWith('/admin/'));
}

// Devolve 'rh', 'colaborador' ou null (ninguém logado).
// Com os dois logins e sem saber de que tela veio, escolhe o mais restrito: o do colaborador.
function modoDeAcesso(req, { rh, colaborador }) {
  if (rh && !colaborador) return 'rh';
  if (colaborador && !rh) return 'colaborador';
  if (!rh && !colaborador) return null;
  return veioDoPainel(req) ? 'rh' : 'colaborador';
}

module.exports = { paginaDeOrigem, veioDoPainel, modoDeAcesso };
