// DESATIVADO. Este era o primeiro envio de contracheques (um PDF só, separado no servidor). Dois problemas:
//  1) cada arquivo ficava no Drive aberto a "qualquer pessoa com o link", sem pedir login;
//  2) não mostrava a prévia para o RH conferir antes de publicar, e podia entregar o contracheque à pessoa errada.
// O envio de hoje é "Distribuir contracheques" (arquivos privados, com conferência antes de publicar).
export async function POST() {
  return Response.json(
    { erro: 'Este envio foi desativado: ele deixava os contracheques abertos para quem tivesse o link e podia confundir pessoas. Use "Distribuir contracheques".' },
    { status: 410 },
  );
}
