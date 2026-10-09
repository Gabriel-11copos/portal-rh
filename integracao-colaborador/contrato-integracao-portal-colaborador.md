# Contrato de integração — Portal do Colaborador ⇄ Portal do Gestor

Grupo Brewteco / Onze Copos · 09/10/2026 · versão 1

Este documento descreve **exatamente** o que os dois portais enviam e esperam receber. O lado do Portal do Gestor está na v30; o lado do Portal do Colaborador é o pacote `integracao-colaborador` (aplicador + arquivos novos), construído seguindo este contrato.

## 1. Como funciona, em uma frase

O colaborador abre um pedido; se o assunto é "do gestor", o Portal do Colaborador **avisa** o Portal do Gestor (aviso assinado). A loja responde lá; o Portal do Gestor **manda a resposta de volta** por API. A conversa existe nos dois lados, ligada por um identificador em comum, sem duplicar.

**Roteamento: pela loja do colaborador**, não por um gestor específico. Qualquer gerente da loja atende; o Portal do Gestor guarda quem ficou responsável.

## 2. Variáveis de ambiente (só os nomes — os valores ficam no Vercel, nunca em conversa)

| Variável | Portal do Gestor | Portal do Colaborador |
|---|---|---|
| `INTEGRACAO_API_KEY` | usada para **enviar** (Bearer) | usada para **conferir** quem chama a API |
| `GESTOR_WEBHOOK_SECRET` | usada para **conferir** a assinatura dos avisos | usada para **assinar** os avisos |
| `COLABORADOR_API_URL` | ex.: `https://falecomdp.vercel.app` | — |
| `GESTOR_WEBHOOK_URL` | — | `https://painel-app-flax.vercel.app/api/integracao/colaborador/evento` |

`INTEGRACAO_API_KEY` e `GESTOR_WEBHOOK_SECRET` têm o **mesmo valor nos dois portais**. Para gerar cada um (execute duas vezes, uma para cada):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Portal do Colaborador → Portal do Gestor (aviso)

`POST {GESTOR_WEBHOOK_URL}`
Cabeçalhos: `Content-Type: application/json` e `X-Signature: sha256=<hex>`

**Assinatura:** HMAC-SHA256 do **corpo exato** (texto bruto, byte a byte) usando `GESTOR_WEBHOOK_SECRET`, em hexadecimal.

```js
const crypto = require('crypto');
const corpo = JSON.stringify(objeto);                       // envie EXATAMENTE este texto
const assinatura = 'sha256=' + crypto.createHmac('sha256', process.env.GESTOR_WEBHOOK_SECRET).update(corpo).digest('hex');
await fetch(process.env.GESTOR_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': assinatura }, body: corpo });
```

### Eventos

Todos levam `evento`, `enviadoEm` e o bloco `solicitacao`. Campos marcados com * são obrigatórios.

```json
{
  "evento": "solicitacao.criada",
  "enviadoEm": "2026-10-09T14:32:10.000Z",
  "solicitacao": {
    "id": "cmu79c79g0001dll6jlzwlspd",        // * id (cuid) da Solicitação — a chave da ligação
    "numero": 128,
    "assunto": "Troca de turno",
    "descricao": "Preciso trocar meu turno de sábado.",
    "status": "pendente",                      // pendente | em_andamento | encerrada
    "prazo": "2026-10-13T03:00:00.000Z",
    "colaborador": { "cpf": "09953633401", "nome": "Fulano de Tal", "loja": "Brewteco Terraço", "cargo": "Garçom" },
    "contato": { "email": "fulano@exemplo.com", "whatsapp": "21999990000" },
    "anexos": [{ "nome": "print.png", "link": "https://drive.google.com/..." }]
  }
}
```

| `evento` | Quando | Campos a mais |
|---|---|---|
| `solicitacao.criada` | colaborador abre o pedido (assunto "do gestor") | — |
| `solicitacao.mensagem` | colaborador (ou o RH, no portal dele) escreve | `mensagem`: `{ id*, texto*, autor*: "colaborador"\|"rh", nomeAutor, data, anexos[], idExterno }` |
| `solicitacao.encerrada` | o pedido é encerrado | — |
| `solicitacao.avaliada` | colaborador dá a nota | `solicitacao.avaliacaoNota` (1 a 5) |

**O que o Portal do Gestor faz com o aviso**
- `colaborador.cpf` (só dígitos): procura o colaborador na lista de ativos e usa a loja de lá. Se não achar, usa `colaborador.loja` (tabela da seção 6). Se nenhuma servir, a solicitação fica em "Sem loja" e só o RH enxerga.
- `descricao` (e os anexos, como links) viram a primeira mensagem.
- É **idempotente**: reenviar o mesmo aviso (mesmo `solicitacao.id` / `mensagem.id`) não duplica nada. Se o `criada` se perder, o primeiro aviso de qualquer tipo cria a solicitação (por isso `solicitacao` vai completo em todos).
- `mensagem.idExterno` começando com `g-` é **eco de uma mensagem do próprio Portal do Gestor** e é ignorado. Mensagens criadas pela API (seção 4) não precisam gerar aviso de volta.

**Respostas do Portal do Gestor:** `200` aplicado · `400` aviso inválido (não reenviar) · `401` assinatura errada (não reenviar) · `503` integração não configurada · `500` erro (reenviar).

**Reenvio (obrigatório do lado de lá):** o Vercel é serverless, então o envio deve ter tempo limite curto (~8 s) e, se falhar (timeout, 5xx, rede), **gravar numa tabela de eventos pendentes** e tentar de novo depois (1, 5, 15 min, 1 h…), sem desistir cedo. Um aviso perdido é um pedido que o gerente nunca vê.

## 4. Portal do Gestor → Portal do Colaborador (API)

Base: `{COLABORADOR_API_URL}/api/integracao/v1`
Cabeçalho: `Authorization: Bearer <INTEGRACAO_API_KEY>` · `Content-Type: application/json`
`{id}` = o mesmo `solicitacao.id` (cuid) dos avisos. O Portal do Gestor tenta até 8 vezes (fila com espera crescente); respostas `2xx` = entregue.

### `POST /solicitacoes/{id}/mensagens`
O gerente respondeu.
```json
{ "gestorCpf": null, "nome": "Marcos Gerente", "loja": "Leblon", "texto": "Pode trocar, já avisei o Caio.", "anexos": [], "idExterno": "g-6" }
```
Efeito esperado: nova `Resposta` com `autor = "gestor"` e `nomeAutor = nome`; status → `respondida`; `vistoColaborador = false` (acende a bolinha). **Idempotência:** se já existir mensagem com esse `idExterno`, responder `200 { "ok": true, "duplicada": true }` sem criar outra.
`nome` já vem pronto para mostrar ("Marcos Gerente", ou "Gestor — Leblon" quando a loja usa o login único, ou "RH"). `gestorCpf` é opcional e hoje vai `null`.

### `POST /solicitacoes/{id}/status`
```json
{ "status": "encerrada", "nome": "Marcos Gerente" }
```
`encerrada` → status `encerrada` + `dataEncerramento`. `em_andamento` → `respondida`. (Decisão do Portal do Colaborador: pedir a avaliação do colaborador quando o gerente encerra.)

### `POST /solicitacoes/{id}/prazo`
```json
{ "novoPrazo": "2026-10-20", "nome": "Marcos Gerente" }
```
Data (`AAAA-MM-DD`). Atualiza `prazo`.

**Erros:** `401` chave inválida · `404` solicitação não existe · `400` corpo inválido. Nunca devolver `5xx` para erro de uso.

## 5. O que o Portal do Colaborador precisa construir

1. **Destino por assunto** (`Assunto.destino`: `rh` | `gestor`, padrão `rh` — assim nada muda até ligar). Operação, folgas, justificar falta, esqueceu de marcar o ponto, pedir uniforme etc. = `gestor`.
2. Campos novos: `Solicitacao.destino`, `Solicitacao.idExterno` (opcional); `Resposta.autor` passa a aceitar `"gestor"`; `Resposta.idExterno`.
3. **Aviso** (seção 3) nos 4 eventos, com fila de pendentes e reenvio.
4. **API** (seção 4) com `INTEGRACAO_API_KEY`, comparando a chave de forma segura.
5. **Tela:** bolha do gestor (com o nome) na conversa; sempre manter o caminho **"falar direto com o RH"** (ex.: queixa sobre o próprio gerente).
6. **Antes de ligar** (do documento do portal): tela de troca de senha no primeiro acesso e troca da senha do banco.

## 6. Tabela de lojas (reserva quando o CPF não está nos ativos)

| `colaborador.loja` | Loja no Portal do Gestor |
|---|---|
| Brewteco Gávea | Gávea |
| Brewteco Terraço | Terraço |
| Brewteco Tijuca | Tijuca |
| Brewteco Rosas | Rosas |
| Brewteco Laranjeiras | Laranjeiras |
| Brewteco Morro da Urca | Morro da Urca |
| Marisqueira do Leblon | Leblon |
| Cervejaria Brewteco (Fábrica) | Cervejaria Brewteco |
| Onze Copos Eventos | Onze Copos Eventos |
| Onze Copos (Administrativo) | **sem gestor definido → o pedido vai direto pro RH** (o Portal do Colaborador nem avisa o Portal do Gestor) |

A comparação ignora acento e maiúscula. **Decisões:** a Lapa não é tratada por esta integração. O Administrativo não tem gestor definido: seus pedidos vão para o RH.

## 7. Como testar

**Sem mexer no Portal do Colaborador** (lado do Gestor), na pasta `painel-app`:
```
node scripts/simular-aviso.mjs https://painel-app-flax.vercel.app SEU_SEGREDO criada 15114704702
node scripts/simular-aviso.mjs https://painel-app-flax.vercel.app SEU_SEGREDO mensagem 15114704702
node scripts/simular-aviso.mjs https://painel-app-flax.vercel.app SEU_SEGREDO encerrada 15114704702
```
(`SEU_SEGREDO` = `GESTOR_WEBHOOK_SECRET`; o último número é o CPF de alguém da lista de ativos.) A solicitação aparece em **Minhas Solicitações** da loja dessa pessoa, marcada "do colaborador".

**Respostas do gerente** só seguem para o outro portal depois que `INTEGRACAO_API_KEY` e `COLABORADOR_API_URL` estiverem configuradas e a API da seção 4 existir. Antes disso, "Responder ao colaborador" avisa que a integração não está configurada e "Nota interna" continua funcionando.

## 8. Fica para a próxima fase

- O gerente **iniciar** conversa e enviar **comunicados** para a equipe (depende do modelo de `Comunicado` e de como abrir conversa pelo lado do colaborador).
- Anexos enviados **pelo gerente** (os do colaborador já chegam como links).
- Aviso por WhatsApp (hoje o aviso é só dentro do app).
