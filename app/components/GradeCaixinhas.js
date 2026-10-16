'use client';
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Estilos das caixinhas (com prefixo "cx-" para não misturar com o resto do sistema).
// Usam as mesmas cores do portal: --verde, --verde-pastel, --border, --muted.
const ESTILOS = `
.cx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.cx-card {
  position: relative; background: #fff; border: 1px solid var(--border); border-radius: 18px;
  padding: 20px 18px; min-height: 150px; cursor: pointer;
  transition: border-color .15s, box-shadow .15s, transform .1s;
}
.cx-card:hover { border-color: var(--verde); box-shadow: 0 8px 22px rgba(7, 94, 84, .13); transform: translateY(-2px); }
.cx-card:focus-visible { outline: 3px solid var(--verde-pastel); border-color: var(--verde); }
.cx-icone {
  width: 52px; height: 52px; border-radius: 16px; background: var(--verde-pastel);
  display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 12px;
}
.cx-titulo { font-size: 16px; font-weight: 700; color: var(--verde); margin-bottom: 4px; }
.cx-desc { font-size: 13px; color: var(--muted); line-height: 1.4; }
.cx-aviso { margin-top: 8px; font-size: 13px; font-weight: 700; color: #b5603a; }
.cx-bolinha {
  position: absolute; top: 10px; right: 12px; background: #d93025; color: #fff; border-radius: 999px;
  min-width: 26px; height: 26px; padding: 0 8px; display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; box-shadow: 0 1px 4px rgba(0, 0, 0, .25);
}
.cx-alca { position: absolute; top: 6px; right: 10px; opacity: .6; font-size: 18px; }
.cx-organizando { outline: 2px dashed #b5603a; outline-offset: -2px; cursor: grab; touch-action: manipulation; user-select: none; }
.cx-organizando:hover { transform: none; box-shadow: none; border-color: var(--border); }
`;

// <ordem>
// As caixinhas que estão na ordem salva vêm primeiro; as novas (ainda fora da ordem salva)
// entram no fim, na ordem padrão. Ids que não existem mais são ignorados.
function aplicarOrdemCaixinhas(cards, ordem) {
  if (!Array.isArray(ordem)) return cards;
  const mapa = new Map(cards.map((c) => [c.id, c]));
  const ordenados = ordem.filter((id) => mapa.has(id)).map((id) => mapa.get(id));
  const resto = cards.filter((c) => !ordem.includes(c.id));
  return [...ordenados, ...resto];
}
// </ordem>

function CartaoOrdenavel({ c, organizando, onAbrir }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id, disabled: !organizando });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 5 : undefined,
  };

  const abrir = () => { if (!organizando) onAbrir(c.id); };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cx-card ${organizando ? 'cx-organizando' : ''}`}
      onClick={abrir}
      {...(organizando
        ? { ...attributes, ...listeners }
        : { role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } } })}
    >
      {organizando && <div className="cx-alca">⠿</div>}
      <div className="cx-icone">{c.icon}</div>
      <div className="cx-titulo">{c.title}</div>
      <div className="cx-desc">{c.desc}</div>
      {c.aviso && <div className="cx-aviso">{c.aviso}</div>}
      {!organizando && c.contador > 0 && (
        <div className="cx-bolinha" title="Esperando você">{c.contador}</div>
      )}
    </div>
  );
}

export default function GradeCaixinhas({ cards, organizando, onAbrir, onReordenar }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),              // mouse: só arrasta depois de mover 6 px
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }), // celular: segurar 200 ms
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })    // teclado
  );

  function aoSoltar({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = cards.map((c) => c.id);
    onReordenar(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
  }

  return (
    <>
      <style>{ESTILOS}</style>
      <DndContext id="caixinhas-painel-rh" sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="cx-grid">
            {cards.map((c) => (
              <CartaoOrdenavel key={c.id} c={c} organizando={organizando} onAbrir={onAbrir} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

export { aplicarOrdemCaixinhas };
