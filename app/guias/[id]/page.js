'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../../components/NavColaborador';
import BotaoVoltar from '../../components/BotaoVoltar';
import GuiaBlocos from '../../components/GuiaBlocos';

export default function LerGuia({ params }) {
  const [guia, setGuia] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch(`/api/guias/${params.id}`)
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.erro || 'Não foi possível abrir o guia.');
        setGuia(json);
      })
      .catch((e) => setErro(e.message || 'Não foi possível abrir o guia.'));
  }, [params.id]);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      {!guia && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}
      {guia && (
        <>
          <h2 style={{ marginBottom: 4 }}>{guia.titulo}</h2>
          {guia.descricao && <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 0 }}>{guia.descricao}</p>}
          <div className="card">
            <GuiaBlocos blocos={guia.blocos} />
          </div>
        </>
      )}
    </div>
  );
}
