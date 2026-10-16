'use client';
import BotaoVoltar from '../../../components/BotaoVoltar';
import EditorGuia from '../../../components/EditorGuia';

export default function NovoGuia() {
  return (
    <div>
      <BotaoVoltar />
      <h2>Novo guia</h2>
      <EditorGuia id={null} />
    </div>
  );
}
