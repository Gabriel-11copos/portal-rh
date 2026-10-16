'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';
import EscalaSemana from '../components/EscalaSemana';

export default function MinhaEscala() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar(dataInicio) {
    setCarregando(true);
    setErro('');
    try {
      const qs = dataInicio ? `?inicio=${dataInicio}` : '';
      const res = await fetch(`/api/escala${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao carregar a escala.');
      setDados(json);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar a escala.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(null); }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minha escala</h2>

      {carregando && !dados && (
        <p style={{ color: 'var(--muted)' }}>Carregando... na primeira vez do dia pode demorar um pouco.</p>
      )}
      {erro && <div className="erro">{erro}</div>}

      {dados && !dados.liberada && (
        <p style={{ color: 'var(--muted)' }}>A escala ainda não está disponível para você.</p>
      )}

      {dados && dados.liberada && (
        <EscalaSemana
          dados={dados}
          carregando={carregando}
          onCarregar={carregar}
          aviso="Escala prevista. Ela pode ser ajustada pela gerência, então em caso de dúvida confirme com seu gestor."
        />
      )}
    </div>
  );
}
