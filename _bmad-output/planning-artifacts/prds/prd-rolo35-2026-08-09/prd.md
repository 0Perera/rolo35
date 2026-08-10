---
title: "PRD: rolo35 — Plataforma de Eventos e Ingressos"
status: final
created: 2026-08-09
updated: 2026-08-09
---

# PRD: rolo35 — Plataforma de Eventos e Ingressos

## 0. Documento

Este PRD parte do [Product Brief](../../briefs/brief-rolo35-2026-08-09/brief.md) (regras de negócio já decididas), do [addendum](../../briefs/brief-rolo35-2026-08-09/addendum.md) (constraints de processo pra épicos/stories), de `docs/decisions.md` (decisões técnicas já tomadas) e de `CLAUDE.md` (stack e non-negotiables) — não duplica o conteúdo desses documentos, referencia e traduz em requisito. Serve de base direta pra arquitetura e pra quebra em épicos/stories. Vocabulário do Glossário (§3) é usado literalmente em todo o documento — sem sinônimo solto. Tags `[ASSUMPTION]` marcaram, durante o rascunho, onde inferi sem confirmação explícita — todas resolvidas e indexadas em §12.

Projeto com prazo de 7 dias corridos (hoje é o dia 2). O documento é enxuto de propósito: prioriza decisão sobre exploração.

Duas coisas defendem este projeto de sair com cara de solução genérica de IA: identidade visual própria (§6) e decisão explícita registrada com o porquê em `docs/decisions.md` a cada ponto onde o documento de requisitos original deixava espaço em aberto — o registro de rationale não é log incidental, é deliberado.

## 1. Vision

rolo35 é uma plataforma de venda de ingressos de cinema. Um organizador monta sessões a partir de um catálogo de filmes real (TMDb), definindo sala, data e preço; um cliente busca essas sessões, reserva assento num mapa de cinema, paga (de forma simulada) e recebe um ingresso com QR assinado — que pode compartilhar por link público; na entrada, a portaria valida esse ingresso por câmera ou digitação manual e recebe uma resposta inequívoca.

O domínio existe pra modelar dois riscos operacionais reais de bilheteria — vender o mesmo assento duas vezes sob concorrência, e aceitar o mesmo ingresso duas vezes na portaria — como invariantes de banco, não como checagem de aplicação que quebra sob corrida.

V1 é o fluxo inteiro rodando fino, ponta a ponta, com as regras de negócio decididas (§4) valendo desde a primeira fatia — não como polimento posterior.

## 2. Target User

### 2.1 Jobs To Be Done

- **Organizador** — montar uma sessão de cinema (filme + sala + data + preço) e confiar que capacidade e preço são respeitados sem venda duplicada; corrigir informação de sessão sem quebrar ingresso já vendido.
- **Cliente** — achar rápido uma sessão com assento disponível, reservar sem disputa silenciosa por assento, pagar, e ter um ingresso que funciona na portaria sem fricção — inclusive se repassado pra quem vai acompanhá-lo.
- **Portaria** — por ingresso escaneado ou digitado, uma resposta rápida e inequívoca (válido / inválido / já utilizado / evento errado), sem depender de olhar o banco manualmente.

### 2.2 Key User Journeys

*UJs abaixo foram estruturadas a partir dos três fluxos já narrados no brief; nomes de persona e alguns detalhes de cena foram inventados pra dar concretude — confirmados em revisão (ver §12).*

- **UJ-1. Marcos publica a sessão de sexta à noite.**
  - **Persona + contexto:** Marcos, organizador de uma sala de cinema pequena, quer abrir venda pra uma sessão antes do fim de semana.
  - **Entry state:** autenticado como `ORGANIZADOR`.
  - **Path:** busca o filme no catálogo (proxy TMDb) → escolhe a sala já cadastrada → define data/hora futura, preço → sistema recusa se já existe sessão na mesma sala no mesmo horário → confirma.
  - **Climax:** sessão aparece publicada e reservável pro cliente.
  - **Resolution:** Marcos acompanha a sessão na lista das que criou; pode editar até a primeira venda confirmada.
  - **Edge case:** tenta editar qualquer campo — inclusive título/sinopse — depois de já ter ≥1 ingresso confirmado; sistema bloqueia a sessão inteira, sem exceção (evita vender ingresso pra um filme e trocar por outro depois).

- **UJ-2. Priya garante dois assentos antes que sumam.**
  - **Persona + contexto:** Priya quer ver um filme com o namorado no sábado, sabe que sessão de estreia lota rápido.
  - **Entry state:** anônima, veio da busca de sessões — explorou o catálogo sem precisar logar.
  - **Path:** filtra sessão por filme/data → abre mapa de assentos da sala, ainda sem login → seleciona 2 assentos livres (limite de 6) → sistema pede cadastro/login como `CLIENTE` pra reservar → reserva (segura por 10 min) → paga no fluxo simulado → recebe 2 ingressos, um por assento, cada um com QR próprio.
  - **Climax:** tela de confirmação mostra os dois ingressos prontos.
  - **Resolution:** ingressos aparecem em "Meus ingressos"; Priya compartilha o link público de um deles com o namorado.
  - **Edge case:** outro cliente reserva um dos assentos que Priya estava vendo um instante antes dela finalizar a seleção — Priya recebe erro claro e volta ao mapa de assentos da mesma sessão, agora atualizado, pra escolher outro.

- **UJ-3. Denise barra um QR fotografado duas vezes.**
  - **Persona + contexto:** Denise, da equipe da portaria, está na sessão das 20h, que já começa a receber o público.
  - **Entry state:** autenticado como `PORTARIA`, seleciona a sessão do turno antes de escanear.
  - **Path:** liga a câmera do dispositivo → aponta pro QR do primeiro cliente → sistema retorna "válido" e marca o ingresso como utilizado → alguns minutos depois, alguém tenta entrar com print do mesmo QR.
  - **Climax:** segunda leitura retorna "já utilizado" de forma inequívoca, sem ambiguidade nem necessidade de conferência manual.
  - **Resolution:** fila continua andando; se a câmera falhar, digita o código manualmente e recebe o mesmo tipo de resposta.
  - **Edge case:** ingresso é de outra sessão — retorno é "evento errado", não "inválido" genérico.

## 3. Glossário

- **Sessão** — exibição de um filme numa sala, com data/hora, preço e capacidade (herdada do mapa da sala). Corresponde ao que o documento de requisitos original chama de "evento"; este PRD usa "sessão" de forma exclusiva, alinhado à tabela `sessoes` do domínio.
- **Sala** — recurso físico com mapa de assentos fixo (linhas × colunas), reutilizável entre sessões. Duas sessões não podem ocupar a mesma sala no mesmo horário.
- **Assento** — unidade de reserva dentro do mapa de uma sala; não pode ser vendido duas vezes pra sessões diferentes que colidam no tempo/sala.
- **Reserva** — vínculo temporário entre cliente, sessão e 1-6 assentos, com TTL de 10 minutos sem pagamento confirmado; expira e libera os assentos se não confirmada.
- **Ingresso** — unidade emitida por assento reservado e pago, com QR assinado (HMAC/JWT). Não é forjável por incremento/adivinhação de ID.
- **Link de compartilhamento** — URL pública, somente leitura, sem login, que espelha o estado atual de um ingresso (válido/usado/evento errado). Não tem ciclo de vida próprio nem expira.
- **Portaria** — papel de conta responsável por validar ingressos na entrada de uma sessão específica, previamente selecionada.
- **Organizador** — papel de conta responsável por criar e gerenciar as sessões que ele mesmo criou.
- **Cliente** — papel de conta responsável por buscar sessões, reservar assento, pagar e receber ingresso.

## 4. Features

### 4.1 Autenticação e Papéis

**Descrição:** três papéis fixos por conta (`ORGANIZADOR`, `CLIENTE`, `PORTARIA`), sem acúmulo. Autorização é checada no back-end em toda requisição, incluindo rotas de portaria — nunca só escondendo botão/rota no front. Cadastro/login não é barreira de entrada pro catálogo — só pro momento da compra (FR-3).

#### FR-1: Login e papel fixo por conta

Usuário autentica via JWT e recebe um único papel fixo (`ORGANIZADOR`, `CLIENTE` ou `PORTARIA`) associado à conta.

**Consequences (testable):**
- Conta não acumula mais de um papel.
- Token carrega o papel; toda rota valida o papel exigido no back-end, não só no front.

#### FR-2: Autorização por dono do recurso

Organizador só edita/gerencia sessões que ele mesmo criou — inclusive na listagem das suas próprias sessões.

**Consequences (testable):**
- Requisição de edição/gestão de sessão de outro organizador retorna erro de autorização, mesmo com token válido de `ORGANIZADOR`.
- Listagem de sessões do organizador autenticado retorna só as sessões que ele criou; sessão de outro organizador não aparece nela.

#### FR-3: Exploração pública do catálogo sem cadastro

Visitante não-autenticado busca sessões publicadas (FR-8) e visualiza o mapa de assentos (FR-9) livremente — ajuda a decidir se vale cadastrar antes de comprar. Cadastro/login como `CLIENTE` só é exigido a partir da reserva de assento (FR-10) em diante.

**Consequences (testable):**
- Listagem de sessões (FR-8) responde sem token de autenticação.
- Mapa de assentos de uma sessão (FR-9) responde sem token de autenticação.
- Tentativa de reserva (FR-10) sem autenticação como `CLIENTE` é rejeitada.

### 4.2 Catálogo de Filmes

**Descrição:** proxy exclusivo do back-end pro TMDb — chave TMDb nunca chega ao client, front consome só os campos que a tela precisa.

#### FR-4: Busca de filmes via proxy TMDb

Organizador busca filmes por título através de endpoint próprio do back-end que faz proxy pro TMDb.

**Consequences (testable):**
- Nenhuma chamada ao TMDb parte do client; chave TMDb não aparece em nenhuma resposta nem no bundle do front.
- Resposta expõe só os campos usados pela tela (título, pôster, sinopse, data de estreia).

### 4.3 Gestão de Sessões (Organizador)

**Descrição:** organizador monta sessões vinculando filme do catálogo a uma sala com mapa de assentos fixo. Realiza UJ-1.

#### FR-5: Criação de sessão

Organizador cria uma sessão vinculando filme (catálogo TMDb), sala (mapa de assentos existente), data/hora futura e preço.

**Consequences (testable):**
- Sessão com data/hora no passado no momento da criação é rejeitada.
- Capacidade da sessão é derivada do mapa de assentos da sala escolhida, não um número livre.

#### FR-6: Bloqueio de conflito de horário na sala

Sistema rejeita criação de sessão cuja sala já tem outra sessão no mesmo horário.

**Consequences (testable):**
- Duas sessões não coexistem na mesma sala com sobreposição de horário.
- Sob duas requisições concorrentes de criação de sessão para a mesma sala com sobreposição de horário (Testcontainers), exatamente uma é aceita — garantido por constraint/lock de banco, não checagem isolada na aplicação (mesma classe de proteção da FR-11, sem a qual duas sessões distintas na mesma sala/horário abririam brecha pra vender o mesmo assento físico duas vezes por caminhos diferentes).

#### FR-7: Edição de sessão com trava pós-venda

Organizador edita uma sessão; assim que houver ≥1 ingresso confirmado para ela, **todos** os campos ficam bloqueados — data, sala/capacidade, preço, título e sinopse, sem exceção. Motivo: título e sinopse vêm do catálogo TMDb (FR-4), não de digitação livre do organizador — não existe cenário de "corrigir erro de digitação" que justifique deixá-los abertos, e permitir a troca depois da venda abre brecha pra vender ingresso pra um filme e trocar por outro depois que o cliente já pagou.

**Consequences (testable):**
- Tentativa de editar qualquer campo (data, sala, preço, título, sinopse) de sessão com ≥1 ingresso confirmado é rejeitada.
- Antes do primeiro ingresso confirmado, todos os campos — incluindo qual filme do catálogo a sessão referencia — seguem editáveis.

Realiza UJ-1.

### 4.4 Busca e Reserva de Assento (Cliente)

**Descrição:** cliente busca sessões publicadas e reserva assento num mapa de cinema. Realiza UJ-2.

#### FR-8: Listagem de sessões publicadas

Cliente lista/busca sessões publicadas; sessão esgotada continua visível, marcada como esgotada.

**Consequences (testable):**
- Sessão sem assento livre não some da listagem — aparece com indicador de esgotado.

#### FR-9: Mapa de assentos da sessão

Cliente visualiza o mapa de assentos da sala da sessão, distinguindo três estados por assento: livre, reservado temporariamente (por qualquer cliente, incluindo hold ativo do próprio) e vendido/pago. Tratamento visual de cada estado (cor, ícone) é decisão de UX (§6), não deste PRD.

**Consequences (testable):**
- Assento com reserva ativa (dentro do TTL) ou vendido não aparece como livre.
- Os três estados são visualmente distinguíveis entre si.
- Resposta do mapa de assentos não inclui identidade do cliente que reservou/comprou cada assento (nome, e-mail, ID de conta) — apenas o estado (livre/reservado/vendido), já que o endpoint é público (FR-3).

#### FR-10: Reserva de assento(s)

Cliente seleciona de 1 a 6 assentos livres de uma sessão; a seleção cria imediatamente um hold temporário (TTL de 10 minutos) sobre cada assento escolhido — é o próprio ato de reservar, não uma etapa separada de "carrinho". Reserva sem pagamento confirmado expira em 10 minutos e libera os assentos. Se a seleção esbarrar num assento que outro cliente acabou de reservar/vender, o pedido é rejeitado e o cliente volta à tela do mapa de assentos da mesma sessão (não reinicia da escolha de sessão), que recarrega com o estado atual.

**Consequences (testable):**
- Tentativa de reservar mais de 6 assentos numa única reserva é rejeitada.
- Reserva não confirmada após 10 minutos libera o(s) assento(s) pra nova reserva.
- Seleção de assento já reservado/vendido por outro cliente é rejeitada com erro claro; cliente permanece no fluxo de reserva da mesma sessão, no mapa de assentos atualizado.
- Reserva de múltiplos assentos é atômica: se qualquer assento do pedido já está indisponível no momento da confirmação, nenhum assento do pedido é retido — a requisição falha por completo, sem hold parcial.

#### FR-11: Não venda duplicada de assento

Sistema garante, via constraint/lock de banco, que o mesmo assento não é reservado/vendido duas vezes para sessões que colidem.

**Consequences (testable):**
- Sob duas requisições concorrentes pro mesmo assento/sessão (Testcontainers), exatamente uma reserva é aceita e a outra falha de forma determinística — não é checagem só na camada de aplicação.

Realiza UJ-2.

### 4.5 Pagamento Simulado

**Descrição:** endpoint interno determinístico, sem gateway real. Cobre aprovação e recusa.

#### FR-12: Pagamento simulado com parâmetro de teste

Cliente confirma pagamento de uma reserva ativa e própria; um parâmetro de teste decide entre aprovação e recusa.

**Consequences (testable):**
- Caminho de aprovação emite ingresso(s).
- Caminho de recusa não emite ingresso e libera o(s) assento(s) imediatamente.
- Confirmação de pagamento de uma reserva pertencente a outro cliente é rejeitada com erro de autorização, mesmo com token válido de `CLIENTE`.
- Confirmação de pagamento de uma reserva cujo TTL já expirou é rejeitada (reserva tratada como inativa), mesmo que o assento ainda não tenha sido formalmente liberado/re-reservado por outro cliente — evita que uma confirmação atrasada emita ingresso pra um assento já reaberto pra outra reserva. Sob essa mesma corrida testada com Testcontainers (expiração de uma reserva A concorrente com criação e confirmação de uma nova reserva B pro mesmo assento), no máximo um ingresso válido existe pro assento/sessão ao final.

#### FR-13: Confirmação de pagamento idempotente

Duas confirmações simultâneas para a mesma reserva não geram ingressos duplicados.

**Consequences (testable):**
- Sob duas requisições concorrentes de confirmação da mesma reserva (Testcontainers), apenas um conjunto de ingressos é emitido.
- Sob duas confirmações concorrentes da mesma reserva com parâmetros de teste conflitantes (uma aprovação, uma recusa), o resultado final é determinístico e consistente entre o estado persistido e a resposta dada a cada chamador — nunca existe um estado em que ingresso é emitido e o assento é liberado para a mesma reserva.

Realiza UJ-2.

### 4.6 Emissão e Consulta de Ingresso

**Descrição:** um ingresso por assento pago, cada um com QR assinado.

#### FR-14: Emissão de ingresso com QR assinado

Sistema emite um ingresso por assento confirmado, cada um com código assinado (HMAC ou JWT assinado) — não um ID incrementável.

**Consequences (testable):**
- Código do ingresso não é adivinhável/forjável por incremento de identificador; assinatura é validada no momento da leitura.
- Um código opaco e aleatório (ex.: UUID) sem assinatura verificável não satisfaz esta FR — a validação recomputa/verifica a assinatura a partir do secret, não apenas compara a existência de um registro no banco.
- Código com assinatura adulterada (payload alterado, ou assinatura válida de outro ingresso colada neste) é rejeitado como inválido na validação, independente de existir linha correspondente no banco.
- Reserva de N assentos confirmada gera N ingressos independentes.

#### FR-15: "Meus ingressos"

Cliente autenticado lista os ingressos vinculados à sua conta.

**Consequences (testable):**
- Cliente não vê ingresso de outra conta na listagem.

Realiza UJ-2.

### 4.7 Compartilhamento Público do Ingresso

**Descrição:** link público, somente leitura, sem exigir login de quem recebe.

#### FR-16: Link público do ingresso

Ingresso tem um link público que exibe seu estado atual (válido/usado/evento errado), acessível sem autenticação e sem prazo de expiração.

**Consequences (testable):**
- Acesso ao link não requer login.
- Link expõe só filme, sessão (sala/data/hora) e estado do próprio ingresso — nenhum outro dado do cliente ou de outros ingressos.
- O identificador usado na URL pública é o mesmo código assinado e não-sequencial da FR-14 (ou equivalente de mesma força) — não uma chave primária sequencial; não é possível enumerar outros ingressos a partir de um link válido.
- Acesso ao link não valida/consome o ingresso — só leitura, sem bypass do fluxo de portaria.

### 4.8 Validação na Portaria

**Descrição:** portaria seleciona a sessão do turno e valida ingresso por câmera ou digitação. Realiza UJ-3.

#### FR-17: Seleção de sessão do turno

Portaria seleciona a sessão ativa antes de validar ingressos.

**Consequences (testable):**
- Validação sem sessão selecionada não é permitida.

#### FR-18: Leitura de ingresso por câmera ou digitação manual

Portaria valida um ingresso lendo o QR pela câmera do dispositivo, acessada via navegador (sem app nativo dedicado, confirmado em revisão — ver §12), ou digitando o código manualmente.

**Consequences (testable):**
- Ambos os caminhos (câmera e digitação) produzem o mesmo resultado de validação pro mesmo código.

#### FR-19: Retorno de validação inequívoco

Sistema responde a cada leitura com exatamente um de: válido, inválido, já utilizado, ou evento errado (ingresso não pertence à sessão selecionada).

**Consequences (testable):**
- Ingresso de outra sessão retorna "evento errado", não "inválido" genérico.
- Requisição de validação (câmera ou digitação) com token de papel `CLIENTE` ou `ORGANIZADOR` retorna erro de autorização, independente de sessão selecionada ou código informado — mesma regra de §4.1/§5, agora como condição testável desta FR.
- Resposta de validação não inclui dado do cliente além do necessário pra decisão operacional da portaria (ex.: nome do filme/assento é aceitável; e-mail, telefone e dado de pagamento não são incluídos).

#### FR-20: Não validação duplicada de ingresso

Sistema garante, via constraint/lock de banco, que o mesmo ingresso não é validado como "utilizado" duas vezes.

**Consequences (testable):**
- Sob duas requisições concorrentes de validação do mesmo ingresso (Testcontainers), exatamente uma retorna "válido" e a outra retorna "já utilizado".

## 5. Cross-Cutting NFRs

**Interface**
- Toda tela que busca dado (listagem de sessões, mapa de assentos, "Meus ingressos", busca de filme no catálogo, etc.) trata explicitamente três estados: carregando, lista vazia e erro — nenhuma tela mostra vazio/quebrado por omissão.

**Segurança**
- Código do ingresso carrega assinatura (HMAC/JWT), nunca só um ID (FR-14).
- Autorização checada em toda requisição no back-end, sem exceção para rotas de portaria (§4.1, §4.8).
- Toda resposta de API é serializada a partir de um DTO explícito por endpoint, nunca da entidade JPA/registro de banco diretamente — nenhum campo chega ao cliente sem estar explicitamente listado no contrato do endpoint (fecha, por construção, casos como hash de senha ou dado de outro usuário vazando por serialização direta).
- Segredos (chave TMDb, secret JWT, credenciais de banco) só em variável de ambiente — nunca commitados, nunca no bundle do client (FR-4).

**Concorrência e integridade de dados**
- Não-venda-duplicada de assento e não-validação-duplicada de ingresso resolvidas com constraint/lock no banco, não só checagem de aplicação (FR-11, FR-20).
- Confirmação de pagamento idempotente sob concorrência (FR-13).
- Índices nas colunas usadas em filtro/join das telas — busca de sessão por data/local, lookup de ingresso por hash do código.
- Sem N+1 nas listagens que juntam dado relacionado (ex.: sessões com filme e sala).

**Testes** *(replicado do CLAUDE.md — vale também como critério de aceite por story, ver §7)*
| O que é | Tipo de teste |
|---|---|
| Regra de negócio pura | Unitário (JUnit + Mockito, sem contexto Spring) |
| Endpoint / autorização | `@WebMvcTest` com service mockado |
| Precisa do banco de verdade | Testcontainers — reservado pros dois cenários de concorrência (FR-11, FR-20) e smoke tests de repository |
| Interação visual (mapa de assentos, câmera) | Cobertura leve, escrita depois do componente, focada em contrato de comportamento |

**Deploy**
- API no Render (free) — dorme após 15 min sem tráfego, ~1 min pra acordar; Postgres free também expira após um tempo (checar prazo no dashboard ao criar). Ambos documentados no README, não escondidos.
- Front-end (SPA) na Vercel.
- Docker Compose local sobe Postgres + API como caminho alternativo garantido caso o deploy tenha problema.

## 6. Identidade Visual

Tema cinema clássico anos 80/90, referência ao rolo de película 35mm — non-negotiable, não polimento de fim de sprint (já fixado no `CLAUDE.md`):

- Contagem regressiva de abertura como transição/loading.
- Perfuração de película como moldura/divisor.
- Paleta sépia/âmbar + vermelho veludo + dourado.
- Tipografia robusta estilo marquise — evitar sans-serif genérica de SaaS.

## 7. Constraints de Processo (Épicos/Stories)

*Levantadas no brief como regras de execução que a criação de épicos/stories deve herdar — explícitas aqui pra não ficarem implícitas na próxima fase.*

- **Primeira story = fatia vertical fina do fluxo completo.** Login → busca de filme → reserva → pagamento simulado → ingresso com QR → validação na portaria, cada etapa no mínimo viável. Fatiar por funcionalidade/tela só depois dessa primeira fatia rodar ponta a ponta.
- **Non-negotiables de segurança como critério de aceite explícito por story**, não implícito. Toda story que toca algum dos non-negotiables de segurança do `CLAUDE.md` declara no seu AC — por exemplo: assinatura do QR não forjável (FR-14), constraint de banco contra dupla-venda de assento (FR-11), constraint contra validação dupla de ingresso (FR-20), link de compartilhamento sem bypass de validação (FR-16), nenhuma resposta de API com campo sensível de banco, segredos só em variável de ambiente (§5). A lista completa é a do `CLAUDE.md`, não só os três exemplos mais citados neste PRD.
- **Estratégia de teste por story** replica a tabela de §5 nos critérios de aceite de cada story — tipo de teste não é escolha livre do implementador.

## 8. Non-Goals (Explicit)

- Nota fiscal.
- Revenda de ingresso entre usuários.
- Aplicativo nativo (portaria e cliente rodam via web).
- Recuperação de senha.
- Envio de ingresso por e-mail.
- Cancelamento de ingresso confirmado — fora do v1 (implica reembolso simulado, restock de assento e invalidação de QR já emitido; complexidade que compete com o fluxo ponta a ponta).

## 9. MVP Scope

### 9.1 In Scope

Fluxo vertical completo: login/papéis → busca de filme (TMDb) → escolha de sessão → reserva de assento em mapa de cinema → pagamento simulado (aprovação e recusa) → ingresso com QR assinado → "Meus ingressos" → validação na portaria (câmera + digitação) → link de compartilhamento público. Todas as FRs de §4 valem desde a primeira fatia vertical, não como polimento posterior.

### 9.2 Out of Scope for MVP

- Busca e filtro avançado de eventos (por gênero, ordenação, etc. além do básico por filme/data).
- Painel do organizador além do CRUD básico de sessão (dashboards, edição em lote).
- Mapa de assentos em tempo real (WebSocket) — sem sincronização ao vivo entre clientes simultâneos no V1; conflito de assento aparece como erro claro na confirmação, mapa recarrega em seguida.

Os três itens acima seguem como candidatos registrados, sem compromisso de tempo — só entram se sobrar prazo depois do V1 completo e testado (decisão explícita, não default por omissão).

## 10. Success Metrics

*Métricas definidas como pass/fail (aconteceu ou não aconteceu), sem meta numérica — confirmado em revisão (ver §12).*

**Primary**
- **SM-1**: Fluxo vertical completo (login → busca → reserva → pagamento → ingresso → portaria → compartilhamento) funciona ponta a ponta antes de qualquer refinamento de tela. Valida FR-1 a FR-20.
- **SM-2**: Nenhum dos dois cenários de concorrência (dupla-venda de assento, dupla-validação de ingresso) falha sob teste de concorrência real com Testcontainers. Valida FR-11, FR-13, FR-20.

**Secondary**
- **SM-3**: README permite a alguém sem contexto prévio rodar o projeto do zero (Docker Compose + seed) e percorrer os quatro perfis de teste sem montar dado manualmente. Valida FR-1, seed de dados.
- **SM-4**: Uso de IA documentado com honestidade, incluindo o que foi ajustado ou rejeitado — não só o que foi aceito como veio.

**Counter-metrics (do not optimize)**
- **SM-C1**: Não otimizar polimento visual de telas secundárias às custas de qualquer elo do fluxo vertical ficar incompleto. Contrabalança SM-1.
- **SM-C2**: Não perseguir Testcontainers cobrindo a aplicação inteira às custas do prazo — cobertura ampla é meta se sobrar tempo, não pré-requisito de v1. Contrabalança SM-2.

## 11. Open Questions

1. **Mecanismo de expiração da reserva (TTL de 10 min).** FR-10 exige que a reserva expire e libere o(s) assento(s) depois de 10 minutos sem pagamento confirmado, mas *como* isso é verificado fica em aberto: checagem preguiçosa (a reserva é tratada como expirada só quando alguém tenta usá-la/consultá-la, sem processo rodando em background) vs. job agendado que varre reservas vencidas periodicamente. As duas cumprem o requisito do FR; a diferença é de arquitetura — custo operacional (job agendado precisa de scheduler rodando) vs. latência de liberação (lazy check só libera o assento no próximo acesso, não no instante exato do vencimento). Fica pra arquitetura decidir; o PRD só fixa o comportamento observável (10 min, libera o assento), não o mecanismo.

2. **Formato do parâmetro de teste do pagamento simulado.** FR-12 exige que "um parâmetro de teste decide entre aprovação e recusa", mas não define onde esse parâmetro vive na requisição — query param (`?resultado=aprovado`), header customizado, ou campo no corpo do POST de confirmação. Afeta diretamente o contrato de API e como os testes de aprovação/recusa são escritos (§5, tabela de testes — isso é endpoint/autorização, então `@WebMvcTest`). Decisão de arquitetura/API, não de produto — o PRD só fixa que os dois caminhos (aprovação e recusa) precisam existir e ter consequência determinística.

## 12. Assumptions Index

*Registro do que entrou no PRD como inferência minha, não como decisão já tomada no brief/addendum/CLAUDE.md. Todas as pendentes abaixo foram confirmadas com o usuário durante o Finalize e já viram fato do PRD nos pontos de origem — mantidas aqui só como rastro do que era suposição.*

- **§2.2, UJ-1/UJ-2/UJ-3 — nomes de persona.** "Marcos", "Priya" e "Denise" foram inventados (brief não nomeia ninguém) pra dar concretude a cada jornada. **Confirmado.**
- **§4.8, FR-18 — câmera da portaria via navegador.** Único caminho coerente, já que app nativo está fora de escopo (`CLAUDE.md`, §8). **Confirmado**, sem hardware dedicado.
- **§10 — métricas sem meta numérica.** Brief não pede número (latência, throughput etc.); SM-1–SM-4 ficam pass/fail. **Confirmado**, sem SM-5 quantitativo.
- **Resolvidas em revisões anteriores:** comportamento de conflito de assento (UJ-2/FR-10) e alcance do FR-3 (mapa de assentos sem login).
