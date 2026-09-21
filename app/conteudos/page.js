'use client';
import { useEffect, useMemo, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

function icone(c) {
  if (c.tipo === 'link') return '🔗';
  if (c.tipo === 'texto') return '📌';
  const ext = (c.nomeArquivo?.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎞️';
  return '📎';
}

export default function Conteudos() {
  const [conteudos, setConteudos] = useState([]);

  useEffect(() => {
    fetch('/api/conteudos').then((r) => r.json()).then(setConteudos);
  }, []);

  const porCategoria = useMemo(() => {
    const grupos = {};
    for (const c of conteudos) {
      if (!grupos[c.categoria]) grupos[c.categoria] = [];
      grupos[c.categoria].push(c);
    }
    return grupos;
  }, [conteudos]);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Conteúdos</h2>

      {conteudos.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum conteúdo publicado ainda.</p>}

      {Object.entries(porCategoria).map(([categoria, itens]) => (
        <div key={categoria} className="card">
          <h3 style={{ marginTop: 0 }}>{categoria}</h3>
          {itens.map((c) => {
            const conteudoClicavel = c.tipo !== 'texto';
            const Wrapper = conteudoClicavel ? 'a' : 'div';
            const props = conteudoClicavel ? { href: c.url, target: '_blank', rel: 'noreferrer' } : {};
            return (
              <Wrapper
                key={c.id}
                {...props}
                style={{
                  display: 'block', padding: '10px 0', borderTop: '1px solid var(--border)',
                  textDecoration: 'none', color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>{icone(c)}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.titulo}</div>
                    {c.descricao && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.descricao}</div>}
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      ))}
    </div>
  );
}
