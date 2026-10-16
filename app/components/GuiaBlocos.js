'use client';

// Mostra os blocos de um guia, de cima para baixo. Usado na leitura do colaborador e na pré-visualização do RH.
export default function GuiaBlocos({ blocos }) {
  return (
    <div>
      {(blocos || []).map((b, i) => {
        if (b.tipo === 'texto') {
          return <p key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: 15, margin: '0 0 16px' }}>{b.texto}</p>;
        }
        if (b.tipo === 'imagem') {
          return (
            <figure key={i} style={{ margin: '0 0 16px' }}>
              <img src={`/api/guias/midia/${b.midiaId}`} alt={b.legenda || 'Imagem do guia'} style={{ width: '100%', maxWidth: 640, borderRadius: 14, display: 'block' }} />
              {b.legenda && <figcaption style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{b.legenda}</figcaption>}
            </figure>
          );
        }
        if (b.tipo === 'arquivo') {
          const href = b.midiaId ? `/api/guias/midia/${b.midiaId}` : b.url;
          return (
            <div key={i} style={{ margin: '0 0 16px' }}>
              <a href={href} target="_blank" rel="noopener noreferrer"><button type="button" className="secundario">📎 {b.nome}</button></a>
            </div>
          );
        }
        if (b.tipo === 'link') {
          return (
            <div key={i} style={{ margin: '0 0 16px' }}>
              <a href={b.url} target="_blank" rel="noopener noreferrer"><button type="button">🔗 {b.texto}</button></a>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
