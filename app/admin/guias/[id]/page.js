'use client';
import BotaoVoltar from '../../../components/BotaoVoltar';
import EditorGuia from '../../../components/EditorGuia';

export default function EditarGuia({ params }) {
  return (
    <div>
      <BotaoVoltar />
      <h2>Editar guia</h2>
      <EditorGuia id={params.id} />
    </div>
  );
}
