import Link from 'next/link';
import BotaoVoltar from '../../components/BotaoVoltar';

// A tela antiga de envio de contracheques foi desativada (deixava o arquivo aberto a quem tivesse o link
// e não deixava conferir antes de publicar). O envio de hoje fica em "Distribuir contracheques".
export default function EnvioAntigoDesativado() {
  return (
    <div>
      <BotaoVoltar />
      <h2>Envio antigo de contracheques</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>Esta tela foi desativada: os arquivos ficavam abertos a quem tivesse o link e não dava para conferir antes de publicar.</p>
        <p>Para enviar contracheques, use <Link href="/admin/contracheques"><b>Distribuir contracheques</b></Link>. Para corrigir ou excluir o que já foi enviado, use <Link href="/admin/contracheques/documentos"><b>Documentos enviados</b></Link>.</p>
      </div>
    </div>
  );
}
