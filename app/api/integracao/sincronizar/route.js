import { getSessaoRH } from '../../../../lib/auth';
import { sincronizarAbertas } from '../../../../lib/integracao';

// Tempo máximo pra esta rota (manda os pedidos em lotes). Se sobrar coisa na fila, é só abrir de novo.
export const maxDuration = 60;

// O RH abre este endereço UMA vez (logado no admin do Portal do Colaborador) pra mandar pro Portal do Gestor
// todos os pedidos que já estão abertos. Repetir é seguro; repita até "restantes" chegar a 0.
export async function GET() {
  const sessao = getSessaoRH();
  if (!sessao) return Response.json({ erro: 'Entre como RH e abra de novo.' }, { status: 401 });
  return Response.json(await sincronizarAbertas());
}
