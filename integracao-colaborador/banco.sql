-- Portal do Colaborador — integração com o Portal do Gestor
-- Rode no SQL Editor do Neon (banco do Portal do Colaborador). É seguro rodar mais de uma vez.

-- Pra onde vai cada tipo de pedido ('rh' = como sempre; 'gestor' = vai pro Portal do Gestor)
ALTER TABLE "Assunto" ADD COLUMN IF NOT EXISTS "destino" TEXT NOT NULL DEFAULT 'rh';
-- Destino de cada pedido (guardado na hora em que o colaborador abre)
ALTER TABLE "Solicitacao" ADD COLUMN IF NOT EXISTS "destino" TEXT NOT NULL DEFAULT 'rh';
-- Id da mensagem que veio do outro portal (evita duplicar quando chega duas vezes)
ALTER TABLE "Resposta" ADD COLUMN IF NOT EXISTS "idExterno" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Resposta_solicitacaoId_idExterno_key" ON "Resposta"("solicitacaoId", "idExterno");

-- Fila de avisos pro Portal do Gestor (se o outro lado estiver fora do ar, tenta de novo)
CREATE TABLE IF NOT EXISTS "EventoPendente" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "evento" TEXT NOT NULL,
  "corpo" TEXT NOT NULL,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadoEm" TIMESTAMP(3),
  "desistiu" BOOLEAN NOT NULL DEFAULT false,
  "erro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
