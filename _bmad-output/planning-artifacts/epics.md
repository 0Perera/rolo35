---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md
---

# rolo35 - Epic Breakdown

## Overview

Este documento decompõe o PRD e a Architecture Spine de rolo35 em épicos e stories implementáveis. Não há documento de UX Design separado neste projeto — a identidade visual (tema cinema 35mm) é fixada como non-negotiable direto no PRD §6 e no `CLAUDE.md`.

## Requirements Inventory

### Functional Requirements

FR-1: Login e papel fixo por conta — usuário autentica via JWT e recebe um único papel fixo (`ORGANIZADOR`, `CLIENTE` ou `PORTARIA`) associado à conta; o token carrega o papel e toda rota valida no back-end, não só no front.
FR-2: Autorização por dono do recurso — organizador só edita/gerencia sessões que ele mesmo criou, inclusive na própria listagem.
FR-3: Exploração pública do catálogo sem cadastro — listagem de sessões (FR-8) e mapa de assentos (FR-9) respondem sem token; reserva (FR-10) sem autenticação como `CLIENTE` é rejeitada.
FR-4: Busca de filmes via proxy TMDb — endpoint próprio do back-end faz proxy pro TMDb; chave TMDb nunca chega ao client nem aparece em resposta alguma.
FR-5: Criação de sessão — organizador vincula filme (catálogo TMDb), sala (mapa de assentos existente), data/hora futura e preço; data/hora no passado é rejeitada; capacidade é derivada do mapa da sala, não um número livre.
FR-6: Bloqueio de conflito de horário na sala — sistema rejeita criação de sessão cuja sala já tem outra sessão com sobreposição real de horário; sob duas criações concorrentes pra mesma sala/horário, exatamente uma é aceita (constraint/lock de banco).
FR-7: Edição de sessão com trava pós-venda — assim que houver ≥1 ingresso confirmado, todos os campos (data, sala/capacidade, preço, título, sinopse) ficam bloqueados, sem exceção.
FR-8: Listagem de sessões publicadas — sessão esgotada não some da listagem, aparece marcada como esgotada.
FR-9: Mapa de assentos da sessão — distingue três estados por assento (livre, reservado temporariamente, vendido/pago); resposta não inclui identidade do cliente que reservou/comprou.
FR-10: Reserva de assento(s) — cliente seleciona 1 a 6 assentos livres; a seleção já cria um hold de 10 min; reserva não confirmada em 10 min libera os assentos; reserva de múltiplos assentos é atômica (sem hold parcial se qualquer assento já está indisponível); seleção de assento já ocupado é rejeitada com erro claro, cliente permanece no mapa da mesma sessão.
FR-11: Não venda duplicada de assento — garantida via constraint/lock de banco; sob duas requisições concorrentes pro mesmo assento/sessão (Testcontainers), exatamente uma é aceita.
FR-12: Pagamento simulado com parâmetro de teste — cliente confirma pagamento de reserva ativa e própria; parâmetro no corpo decide aprovação/recusa; aprovação emite ingresso(s); recusa não emite ingresso e libera o(s) assento(s) imediatamente; confirmação de reserva de outro cliente ou já expirada é rejeitada.
FR-13: Confirmação de pagamento idempotente — duas confirmações concorrentes da mesma reserva não geram ingressos duplicados; resultado determinístico mesmo com parâmetros de teste conflitantes entre as duas chamadas.
FR-14: Emissão de ingresso com QR assinado — código assinado (HMAC/JWT), não ID incrementável; assinatura é validada recomputando a partir do secret, não só existência de registro; assinatura adulterada é rejeitada; N assentos confirmados geram N ingressos independentes.
FR-15: "Meus ingressos" — cliente autenticado lista só os ingressos vinculados à própria conta.
FR-16: Link público do ingresso — somente leitura, sem login, sem expiração; expõe só filme/sessão/estado do próprio ingresso; usa o mesmo código assinado não-sequencial da FR-14; não valida/consome o ingresso.
FR-17: Seleção de sessão do turno — portaria seleciona a sessão ativa antes de validar; validação sem sessão selecionada não é permitida.
FR-18: Leitura de ingresso por câmera (via navegador) ou digitação manual — ambos os caminhos produzem o mesmo resultado pro mesmo código.
FR-19: Retorno de validação inequívoco — exatamente um de: válido, inválido, já utilizado, evento errado; requisição com papel `CLIENTE`/`ORGANIZADOR` é rejeitada; resposta não inclui dado sensível do cliente além do necessário à operação.
FR-20: Não validação duplicada de ingresso — garantida via constraint/lock de banco; sob duas validações concorrentes do mesmo ingresso (Testcontainers), exatamente uma retorna "válido" e a outra "já utilizado".

### NonFunctional Requirements

NFR-1 (Interface): Toda tela que busca dado (listagem de sessões, mapa de assentos, "Meus ingressos", busca de filme) trata três estados: carregando, lista vazia, erro.
NFR-2 (Segurança): Código do ingresso carrega assinatura (HMAC/JWT), nunca só um ID.
NFR-3 (Segurança): Autorização checada em toda requisição no back-end, sem exceção pras rotas de portaria.
NFR-4 (Segurança): Toda resposta de API é serializada a partir de DTO explícito por endpoint, nunca da entidade JPA/registro de banco diretamente.
NFR-5 (Segurança): Segredos (chave TMDb, secret JWT, credenciais de banco) só em variável de ambiente — nunca commitados, nunca no bundle do client.
NFR-6 (Concorrência/Integridade): Não-venda-duplicada de assento e não-validação-duplicada de ingresso resolvidas com constraint/lock de banco, não checagem de aplicação.
NFR-7 (Concorrência/Integridade): Confirmação de pagamento idempotente sob concorrência.
NFR-8 (Dados/Performance): Índices nas colunas usadas em filtro/join das telas — busca de sessão por data/local, lookup de ingresso por hash do código.
NFR-9 (Dados/Performance): Sem N+1 nas listagens que juntam dado relacionado (ex.: sessões com filme e sala).
NFR-10 (Testes): Estratégia de teste por camada — unitário (regra de negócio pura), `@WebMvcTest` (endpoint/autorização), Testcontainers restrito aos dois cenários de concorrência (FR-11, FR-20) + smoke tests de repository.
NFR-11 (Deploy): API + Postgres no Render free (cold start ~1min documentado, Postgres expira — checar prazo no dashboard); front na Vercel; Docker Compose local (Postgres + API) como fallback garantido.

### Additional Requirements

- Sem starter template greenfield — repositório já tem scaffold inicial (back-end Spring Boot e front Next.js existentes); Architecture determina re-scaffold de `web/` de Next.js pra Vite+React como tarefa de implementação da primeira story (fatia vertical), não pendência de arquitetura.
- Empacotamento por domínio no back-end (`auth`, `sessoes`, `reservas`, `pagamentos`, `ingressos`), cada um com `controller/service/repository` próprios; direção de dependência fixa: `{pagamentos, ingressos} → reservas → sessoes → auth` (AD-1).
- Camada `api/` dedicada no front-end (`web/src/api/*`), um módulo por domínio, sem `fetch` direto em componente; `client.ts` com timeout com folga pro cold start do Render (AD-2).
- Lock de assento via linha pré-criada (`assento_sessao`, populada na criação da sessão) + `SELECT ... FOR UPDATE` ordenado por `assento_id` na reserva; FR-6 reaproveita o mesmo primitivo com lock na linha da `sala` + checagem de sobreposição real com buffer fixo de 4h (AD-3).
- TTL de reserva calculado lazy a partir de `expires_at` em toda leitura/escrita de estado de assento, sem job agendado (AD-4).
- Transação de lock curta com `lock_timeout` próprio, sem chamada externa nem escrita não relacionada dentro dela (AD-5).
- Confirmação de pagamento idempotente via lock pessimista em `reserva`; 3 estados persistidos (`ATIVA`, `CONFIRMADA`, `RECUSADA`), "expirada" é calculado; resposta sempre `200` com `{status, ingressos}` refletindo o estado persistido (AD-6).
- Parâmetro de teste do pagamento simulado (`resultadoSimulado`) no corpo do `POST`, validado por Bean Validation (AD-7).
- Código de ingresso HMAC-SHA256 (`uuid + "." + base64url(HMAC-SHA256(secret, uuid))`), sem coluna própria de código; validação recomputa o HMAC antes de tocar o banco (AD-8).
- Rotas separadas: `GET /ingressos/{codigo}` pública, somente leitura, sem lock; `POST /portaria/validacoes` exige papel `PORTARIA` + sessão selecionada, único lugar que transiciona `VALIDO → UTILIZADO` (AD-9).
- Autenticação Bearer JWT (claim `papel`) em header `Authorization`, `localStorage` no front, CORS allow-list sem `credentials` (AD-10).
- Envelope de erro único `{codigo, mensagem}` via `GlobalExceptionHandler`; fallback genérico pra exceção não mapeada (`500`, `ERRO_INTERNO`) (AD-11).
- DTO explícito por endpoint, nunca entidade JPA direta (AD-12).
- Nomenclatura: entidades/tabelas em português, código em inglês (AD-13).
- Sem tabela `filmes` própria — `sessoes` grava snapshot direto dos campos TMDb usados pela tela (`tmdb_id`, `titulo`, `poster_url`, `sinopse`, `data_estreia`) (AD-14).
- Migrations Flyway: `V1__schema.sql` (schema completo, 7 entidades) e `V2__seed.sql` (seed versionado: 1 organizador, 2 clientes, 1 portaria, 1 sessão publicada com assentos livres).
- Stack fixada: Java 21, Spring Boot 4.1.0, PostgreSQL 16, Vite 8.x, React 19.2.8, TypeScript 6.x, Tailwind CSS 4.x, JUnit 5/Mockito/Testcontainers.
- Deploy: front na Vercel; back-end + Postgres no Render free; Docker Compose local como fallback garantido.
- Rate limiting em endpoints públicos deliberadamente fora do V1 (decisão explícita da Architecture, Deferred).

### UX Design Requirements

N/A — nenhum documento de UX Design encontrado no projeto. A identidade visual (tema cinema clássico anos 80/90, contagem regressiva como transição/loading, perfuração de película como moldura/divisor, paleta sépia/âmbar + vermelho veludo + dourado, tipografia robusta estilo marquise) é fixada como non-negotiable direto no PRD §6 / `CLAUDE.md`, sem spec de design tokens ou componentes reutilizáveis detalhada — será tratada como requisito de estilo transversal nas stories de UI, não como stories de UX dedicadas.

### FR Coverage Map

```
FR1: Epic 1 - Login JWT com papel fixo por conta
FR2: Epic 2 - Organizador só gerencia sessões próprias
FR3: Epic 3 - Catálogo/mapa público sem cadastro
FR4: Epic 1 - Busca de filmes via proxy TMDb
FR5: Epic 2 - Criação de sessão
FR6: Epic 2 - Bloqueio de conflito de horário na sala
FR7: Epic 2 - Trava de edição pós-venda
FR8: Epic 2 - Listagem de sessões publicadas (com esgotada)
FR9: Epic 3 - Mapa de assentos por estado
FR10: Epic 3 - Reserva de assento(s) com hold de 10min
FR11: Epic 3 - Não-venda-duplicada de assento
FR12: Epic 4 - Pagamento simulado com parâmetro de teste
FR13: Epic 4 - Confirmação de pagamento idempotente
FR14: Epic 4 - Emissão de ingresso com QR assinado
FR15: Epic 4 - "Meus ingressos"
FR16: Epic 4 - Link público do ingresso
FR17: Epic 5 - Seleção de sessão do turno
FR18: Epic 5 - Leitura de ingresso (câmera ou manual)
FR19: Epic 5 - Retorno de validação inequívoco
FR20: Epic 5 - Não-validação-duplicada de ingresso
```

Todas as NFRs (NFR-1 a NFR-11) são transversais e se aplicam como critério de aceitação dentro das stories de cada épico, não como épico dedicado.

## Epic List

### Epic 1: Autenticação e Catálogo de Filmes
Qualquer usuário se autentica com papel fixo (organizador/cliente/portaria) via JWT, e o sistema busca filmes em cartaz via proxy TMDb sem expor a chave ao client.
**FRs cobertos:** FR1, FR4

**Notas de implementação:**
- Sem starter template greenfield: inclui o re-scaffold de `web/` de Next.js pra Vite+React (tarefa da primeira story, fatia vertical fina — não reescrita completa).
- Ordem de stories combinada: (1) Fundação — Flyway `V1__schema.sql` com o schema completo das 7 entidades + `V2__seed.sql` (seed versionado: 1 organizador, 2 clientes, 1 portaria, 1 sessão publicada com assentos livres), plugando no `docker-compose.yml` (Postgres+API) já existente; (2) Login JWT com papel fixo; (3) Busca de filme via proxy TMDb. Motivo de subir o schema completo de uma vez (AD-3, decisão da Architecture Spine): entidades de domínios diferentes (`assento_sessao`, `reservas`, `pagamentos`, `ingressos`) têm FKs cruzadas — fatiar a migration por épico geraria retrabalho de ALTER a cada épico sem ganho real, e os testes de concorrência (Testcontainers) de épicos futuros (FR-6, FR-11, FR-20) precisam do schema completo de pé desde cedo.

### Epic 2: Gestão de Sessões (Organizador)
Organizador vincula filme + sala + horário + preço pra criar uma sessão, com bloqueio de conflito de horário na sala e trava de edição pós-venda. Sessões publicadas aparecem na listagem pública, mesmo esgotadas.
**FRs cobertos:** FR2, FR5, FR6, FR7, FR8

### Epic 3: Reserva de Assentos (Cliente)
Qualquer visitante explora o catálogo público sem login; cliente autenticado seleciona de 1 a 6 assentos livres no mapa da sessão, com hold temporário de 10 min, atomicidade na seleção múltipla e garantia de não-venda-duplicada sob concorrência.
**FRs cobertos:** FR3, FR9, FR10, FR11

### Epic 4: Pagamento e Emissão de Ingresso
Cliente confirma pagamento simulado (aprovação/recusa determinística) da própria reserva ativa; aprovação emite ingresso(s) com QR assinado (HMAC), de forma idempotente sob concorrência. Cliente vê "Meus ingressos" e pode compartilhar o link público somente-leitura.
**FRs cobertos:** FR12, FR13, FR14, FR15, FR16

**Notas de implementação:** Pagamento e emissão de ingresso ficam no mesmo épico — arquitetura decide que a confirmação de pagamento já retorna o ingresso na mesma resposta (`{status, ingressos}`, AD-6), então são uma ação única do ponto de vista do usuário, não dois fluxos independentes.

### Epic 5: Validação na Portaria
Portaria seleciona a sessão ativa do turno e valida ingressos por câmera ou digitação manual, com retorno inequívoco (válido/inválido/já utilizado/evento errado) e garantia de não-validação-duplicada sob concorrência.
**FRs cobertos:** FR17, FR18, FR19, FR20

## Epic 1: Autenticação e Catálogo de Filmes

Qualquer usuário se autentica com papel fixo (organizador/cliente/portaria) via JWT, e o sistema busca filmes em cartaz via proxy TMDb sem expor a chave ao client.

### Story 1.1: Fundação e Login com Papel Fixo

As a usuário do sistema (organizador, cliente ou portaria),
I want autenticar com minhas credenciais e receber um token que carregue meu papel,
So that eu acesse só as rotas permitidas pro meu papel, com o ambiente de dados já pronto.

**Acceptance Criteria:**

**Given** o repositório limpo
**When** `docker compose up` é executado na raiz
**Then** Postgres e a API sobem, o Flyway aplica `V1__schema.sql` (schema completo das 7 entidades: usuários, sessões, salas, assentos, assento_sessao, reservas, ingressos) automaticamente na subida, e um endpoint de health-check responde `200`

**Given** o schema aplicado
**When** `V2__seed.sql` roda
**Then** existem exatamente os perfis seed: 1 organizador, 2 clientes, 1 portaria, e 1 sessão publicada com assentos livres — todos com senha conhecida documentada no README

**Given** o front-end atual em Next.js
**When** o re-scaffold pra Vite+React é aplicado
**Then** `npm run dev` em `web/` sobe uma SPA funcional apontando pra API local, sem sobra de arquivo/config do Next.js anterior

**Given** um usuário seed válido (ex.: cliente) e sua senha correta
**When** ele faz `POST` no endpoint de login
**Then** recebe `200` com um JWT assinado cujo claim inclui o `papel` da conta e uma expiração definida

**Given** credenciais inválidas (senha errada ou e-mail inexistente)
**When** o login é tentado
**Then** a resposta é `401` com o mesmo envelope de erro genérico (`{codigo, mensagem}`) — não revela se o e-mail existe ou não

**Given** um JWT válido de um papel qualquer
**When** a resposta de qualquer endpoint autenticado é inspecionada
**Then** nenhum campo sensível de banco (hash de senha, etc.) é retornado — resposta sempre via DTO explícito, nunca a entidade JPA direto

**Given** a tela de login no front-end
**When** o usuário envia o formulário com sucesso
**Then** o token é guardado (`localStorage`) e o usuário é redirecionado conforme o papel; em erro, a tela mostra mensagem clara sem travar em estado de carregamento indefinido

**Given** a tabela de usuários
**When** a query de login busca por e-mail
**Then** existe índice na coluna de lookup (NFR-8)

### Story 1.2: Busca de Filmes via Proxy TMDb

As a usuário autenticado (tipicamente organizador, na hora de criar sessão),
I want buscar filmes em cartaz por título,
So that eu escolho qual filme vincular a uma sessão sem nunca falar direto com o TMDb.

**Acceptance Criteria:**

**Given** uma chave TMDb válida configurada via variável de ambiente no back-end
**When** `GET /api/filmes/buscar?query={termo}` é chamado com um termo válido
**Then** o back-end faz proxy pro TMDb e retorna só os campos que a tela precisa (título, pôster, sinopse, data de estreia) — a chave TMDb nunca aparece na resposta nem em nenhum header exposto ao client

**Given** o bundle do front-end
**When** inspecionado (build de produção)
**Then** a chave TMDb não existe em nenhum arquivo servido ao client — a chamada ao TMDb é responsabilidade exclusiva do back-end

**Given** uma busca sem resultados
**When** a tela de busca recebe a resposta
**Then** mostra estado de lista vazia, não um erro

**Given** o TMDb fora do ar ou respondendo com timeout
**When** a busca é feita
**Then** a tela mostra estado de erro claramente distinto do estado de lista vazia, sem travar em carregamento

**Given** a busca em andamento
**When** a requisição ainda não retornou
**Then** a tela mostra estado de carregamento

**Given** a chave TMDb ausente ou inválida na configuração do back-end
**When** o endpoint de busca é chamado
**Then** retorna erro controlado via envelope `{codigo, mensagem}`, sem vazar detalhe da resposta bruta do TMDb

### Story 1.3: Autocadastro de Cliente

> Adicionada após o desenho de arquitetura, a partir do handoff de design (`Rolo 35.dc.html`, ver `docs/decisions.md` — "Escopo novo: autocadastro de cliente"). Sem FR própria no PRD original — mesma classe de adição que `GET /api/salas` na Story 2.1: infraestrutura mínima pra uma tela do design funcionar de ponta a ponta, não abertura de escopo maior (organizador/portaria continuam só por seed).

As a visitante sem conta,
I want criar minha própria conta com papel CLIENTE,
So that eu reserve assentos sem depender de um cadastro feito manualmente por outra pessoa.

**Acceptance Criteria:**

**Given** um visitante na tela de cadastro, preenchendo nome, e-mail, senha e aceite dos termos
**When** submete com todos os campos válidos e e-mail ainda não usado
**Then** uma conta com papel `CLIENTE` é criada, senha armazenada com hash (nunca em texto puro), e o fluxo segue pro login (ou já retorna token, a critério da implementação)

**Given** um cadastro com e-mail já existente
**When** submetido
**Then** retorna erro claro via envelope `{codigo, mensagem}`, sem confirmar/negar implicitamente se o e-mail pertence a outra conta de forma que vaze dado sensível

**Given** o endpoint de cadastro
**When** chamado com `papel` diferente de `CLIENTE` (manipulação direta da requisição, já que a UI não expõe essa opção)
**Then** o back-end rejeita ou ignora o campo — nunca cria conta `ORGANIZADOR`/`PORTARIA` por essa via; esses papéis só existem via seed/gestão manual

**Given** senha ou e-mail em formato inválido
**When** submetido
**Then** validação de campo (`@Valid`) rejeita antes de tocar o banco, com mensagem de erro por campo

## Epic 2: Gestão de Sessões (Organizador)

Organizador vincula filme + sala + horário + preço pra criar uma sessão, com bloqueio de conflito de horário na sala e trava de edição pós-venda. Sessões publicadas aparecem na listagem pública, mesmo esgotadas.

### Story 2.1: Criação de Sessão com Bloqueio de Conflito de Horário

As a organizador,
I want criar uma sessão vinculando um filme do catálogo, uma sala existente, data/hora futura e preço,
So that eu abro venda de ingressos pra um horário sem risco de colidir com outra sessão na mesma sala.

**Acceptance Criteria:**

**Given** um organizador autenticado, um filme buscado via catálogo TMDb, uma sala já cadastrada e uma data/hora futura
**When** ele submete a criação da sessão com um preço
**Then** a sessão é criada com capacidade derivada do mapa de assentos da sala (não um número digitado livremente) e vinculada ao organizador como dono do recurso

**Given** uma data/hora no passado
**When** a criação é submetida
**Then** é rejeitada com erro claro, sessão não é criada

**Given** uma sala que já tem outra sessão cujo horário se sobrepõe (considerando o buffer fixo de 4h entre sessões na mesma sala, AD-3)
**When** uma nova sessão conflitante é submetida
**Then** é rejeitada — duas sessões não coexistem na mesma sala com sobreposição real de horário

**Given** duas requisições concorrentes de criação de sessão pra mesma sala com horário sobreposto (cenário Testcontainers)
**When** ambas são disparadas ao mesmo tempo
**Then** exatamente uma é aceita, garantido por constraint/lock de banco — não checagem isolada na aplicação

**Given** um usuário autenticado como `CLIENTE` ou `PORTARIA`
**When** tenta criar uma sessão
**Then** a requisição é rejeitada com `403`

### Story 2.2: Edição de Sessão com Trava Pós-Venda

As a organizador,
I want gerenciar e editar apenas as sessões que eu mesmo criei, e ser barrado de editar qualquer campo assim que a sessão já tiver ingresso vendido,
So that eu corrijo dados antes da venda sem risco de quebrar ingresso já emitido, e não interfiro em sessões de outro organizador.

**Acceptance Criteria:**

**Given** sessões criadas por múltiplos organizadores
**When** um organizador lista suas próprias sessões
**Then** só vê as que ele mesmo criou — nunca as de outro organizador, nem na própria listagem de gestão

**Given** uma sessão criada por outro organizador
**When** ele tenta editá-la (mesmo sabendo o ID)
**Then** a requisição é rejeitada com `403`

**Given** uma sessão própria sem nenhum ingresso confirmado
**When** ele edita data, sala, preço, título ou sinopse
**Then** a edição é aceita e persistida

**Given** uma sessão própria com ≥1 ingresso confirmado
**When** ele tenta editar qualquer campo — data, sala/capacidade, preço, título ou sinopse
**Then** a edição é rejeitada, sem exceção pra nenhum campo, com erro claro indicando o motivo

**Given** a resposta de qualquer endpoint de gestão de sessão
**When** inspecionada
**Then** não expõe dado de outro organizador nem identidade de cliente

### Story 2.3: Listagem Pública de Sessões

As a visitante (sem login),
I want ver a lista de sessões publicadas, incluindo as esgotadas,
So that eu descubra o que tem em cartaz mesmo sem conta.

**Acceptance Criteria:**

**Given** sessões publicadas existentes, algumas com assentos livres e outras esgotadas
**When** `GET` na listagem de sessões é chamado sem autenticação
**Then** todas aparecem, cada uma marcada com seu estado (com vaga / esgotada) — sessão esgotada não some da lista

**Given** a listagem
**When** ela junta dado de filme e sala pra cada sessão
**Then** não há N+1 — uma única consulta (projection/fetch join) traz sessão + filme + sala juntos

**Given** nenhuma sessão publicada no momento
**When** a listagem é consultada
**Then** o front-end mostra estado de lista vazia, não erro

**Given** a listagem em carregamento
**When** a requisição ainda não retornou
**Then** o front-end mostra estado de carregamento

**Given** a listagem retorna erro (ex.: back-end indisponível)
**When** o front-end recebe a falha
**Then** mostra estado de erro distinto do estado de lista vazia

## Epic 3: Reserva de Assentos (Cliente)

Qualquer visitante explora o catálogo público sem login; cliente autenticado seleciona de 1 a 6 assentos livres no mapa da sessão, com hold temporário de 10 min, atomicidade na seleção múltipla e garantia de não-venda-duplicada sob concorrência.

### Story 3.1: Mapa de Assentos Público

As a visitante (sem login),
I want ver o mapa de assentos de uma sessão específica,
So that eu decida se quero reservar antes mesmo de criar conta.

**Acceptance Criteria:**

**Given** uma sessão publicada com assentos em estados variados (livre, hold ativo, vendido)
**When** o mapa de assentos da sessão é consultado sem token
**Then** retorna todos os assentos com seu estado (livre / reservado temporariamente / vendido), sem exigir autenticação

**Given** o mapa retornado
**When** inspecionado
**Then** não inclui identidade do cliente que reservou ou comprou nenhum assento

**Given** um hold de 10 min já expirado
**When** o mapa é consultado (TTL calculado lazy a partir de `expires_at`, sem job agendado — AD-4)
**Then** o assento aparece como livre novamente

**Given** uma sessão inexistente
**When** o mapa é consultado
**Then** retorna `404`, e o front-end mostra estado de erro

**Given** o mapa em carregamento no front-end
**When** a requisição ainda não retornou
**Then** mostra estado de carregamento

### Story 3.2: Reserva de Assentos com Hold Temporário

As a cliente autenticado,
I want selecionar de 1 a 6 assentos livres e reservá-los,
So that eu garanto minha escolha por um tempo enquanto decido pagar, sem risco de perder pra outro cliente.

**Acceptance Criteria:**

**Given** um cliente autenticado e de 1 a 6 assentos livres na mesma sessão selecionados
**When** ele confirma a seleção
**Then** um hold de 10 min é criado pra todos os assentos de uma vez, de forma atômica

**Given** uma seleção que inclui pelo menos um assento que já não está mais livre (hold de outro cliente ou vendido)
**When** a reserva é submetida
**Then** nenhum assento da seleção é reservado (sem hold parcial), erro claro é retornado, e o cliente permanece no mapa da mesma sessão

**Given** um visitante sem login, ou autenticado como `ORGANIZADOR`/`PORTARIA`
**When** tenta reservar assento
**Then** a requisição é rejeitada (só `CLIENTE` autenticado reserva)

**Given** um hold criado há mais de 10 min sem confirmação de pagamento
**When** o estado do assento é consultado ou reavaliado
**Then** ele volta a ficar livre (TTL calculado lazy a partir de `expires_at`, sem job agendado — AD-4)

**Given** duas requisições concorrentes tentando reservar o mesmo assento na mesma sessão (cenário Testcontainers)
**When** ambas disparadas simultaneamente
**Then** exatamente uma é aceita, garantido por lock de banco ordenado por `assento_id` (AD-3) — não checagem isolada na aplicação

**Given** uma seleção de mais de 6 assentos, ou uma seleção vazia
**When** submetida
**Then** rejeitada com erro claro, nenhum hold é criado

## Epic 4: Pagamento e Emissão de Ingresso

Cliente confirma pagamento simulado (aprovação/recusa determinística) da própria reserva ativa; aprovação emite ingresso(s) com QR assinado (HMAC), de forma idempotente sob concorrência. Cliente vê "Meus ingressos" e pode compartilhar o link público somente-leitura.

### Story 4.1: Confirmação de Pagamento Simulado com Emissão de Ingresso

As a cliente autenticado,
I want confirmar o pagamento (simulado) da minha reserva ativa,
So that eu recebo meu(s) ingresso(s) com QR assinado se aprovado, ou tenho os assentos liberados imediatamente se recusado.

**Acceptance Criteria:**

**Given** uma reserva ativa e própria do cliente (hold não expirado)
**When** ele confirma o pagamento com o parâmetro de teste indicando aprovação
**Then** a reserva muda pra `CONFIRMADA` e um ingresso é emitido pra cada assento reservado (N assentos confirmados → N ingressos independentes), cada um com código assinado HMAC-SHA256 (`uuid + "." + base64url(HMAC-SHA256(secret, uuid))`), sem coluna própria de código (AD-8)

**Given** a mesma reserva
**When** o pagamento é confirmado com o parâmetro de teste indicando recusa
**Then** a reserva muda pra `RECUSADA`, nenhum ingresso é emitido, e os assentos voltam a `livre` imediatamente

**Given** uma reserva pertencente a outro cliente
**When** ele tenta confirmar o pagamento dela
**Then** a requisição é rejeitada, sem revelar se a reserva existe ou de quem é

**Given** uma reserva já expirada (hold vencido)
**When** a confirmação de pagamento é tentada
**Then** rejeitada com erro claro

**Given** duas confirmações concorrentes da mesma reserva — inclusive com parâmetros de teste conflitantes entre as duas chamadas
**When** ambas disparadas ao mesmo tempo (cenário Testcontainers)
**Then** o resultado é determinístico, nenhum ingresso duplicado é gerado, via lock pessimista na reserva (AD-6) — a resposta é sempre `200` com `{status, ingressos}` refletindo o estado persistido, para as duas chamadas

**Given** um código de ingresso recém-emitido
**When** a assinatura é recomputada a partir do secret e comparada ao hash embutido no código
**Then** a verificação bate — não depende só de existir um registro no banco

**Given** um código de ingresso com o hash adulterado
**When** a verificação de assinatura roda sobre ele
**Then** é detectado como inválido

### Story 4.2: Meus Ingressos e Link Público

As a cliente autenticado,
I want ver todos os meus ingressos e compartilhar um link público de leitura pra cada um,
So that eu tenho comprovante de compra e posso mostrar o ingresso sem precisar logar de novo.

**Acceptance Criteria:**

**Given** um cliente autenticado com ingressos emitidos
**When** ele acessa "Meus ingressos"
**Then** vê só os ingressos vinculados à própria conta — nunca de outro cliente

**Given** nenhum ingresso emitido ainda
**When** "Meus ingressos" é consultado
**Then** o front-end mostra estado de lista vazia, não erro

**Given** um código de ingresso válido
**When** o link público (`GET /ingressos/{codigo}`) é acessado sem login
**Then** retorna só filme, sessão (sala/data/hora) e o estado do próprio ingresso — nenhum outro dado do cliente ou de outros ingressos, sem exigir autenticação, sem expiração, e sem lock (rota somente-leitura, AD-9)

**Given** o link público de um ingresso
**When** acessado
**Then** ele não valida nem consome o ingresso — é estritamente leitura, não interfere no estado usado pela portaria

**Given** um código de ingresso inexistente ou com assinatura inválida
**When** o link público é acessado
**Then** retorna erro claro (`404`), sem vazar se o UUID existe no banco

## Epic 5: Validação na Portaria

Portaria seleciona a sessão ativa do turno e valida ingressos por câmera ou digitação manual, com retorno inequívoco (válido/inválido/já utilizado/evento errado) e garantia de não-validação-duplicada sob concorrência.

### Story 5.1: Seleção de Sessão do Turno

As a usuário PORTARIA,
I want selecionar a sessão ativa do meu turno antes de validar qualquer ingresso,
So that toda validação seguinte já sabe contra qual sessão comparar o código.

**Acceptance Criteria:**

**Given** um usuário PORTARIA autenticado sem sessão selecionada
**When** ele tenta validar um ingresso sem antes escolher uma sessão
**Then** a operação é bloqueada, exigindo seleção prévia de sessão

**Given** sessões publicadas disponíveis
**When** a portaria seleciona uma delas pro turno
**Then** essa sessão fica marcada como ativa pro contexto de validação desse usuário

**Given** um usuário CLIENTE ou ORGANIZADOR
**When** tenta acessar a seleção de sessão de portaria
**Then** a requisição é rejeitada com `403`

**Given** a lista de sessões disponíveis pra seleção
**When** carregando, vazia, ou com erro
**Then** o front-end trata os três estados

### Story 5.2: Validação de Ingresso na Portaria

As a usuário PORTARIA,
I want ler um ingresso por câmera ou digitação manual e receber um resultado inequívoco,
So that eu decido se libero a entrada com confiança, sem depender de julgamento visual.

**Acceptance Criteria:**

**Given** uma sessão ativa selecionada e um código de ingresso válido, não usado, da sessão correta
**When** lido por câmera (QR) ou digitado manualmente
**Then** ambos os caminhos produzem o mesmo resultado — "válido" — e o ingresso passa a `UTILIZADO`

**Given** um código com assinatura adulterada ou inexistente
**When** validado
**Then** retorna "inválido"

**Given** um ingresso já validado anteriormente
**When** validado de novo
**Then** retorna "já utilizado", sem mudar de estado outra vez

**Given** um ingresso válido, mas de uma sessão diferente da selecionada pela portaria
**When** validado
**Then** retorna "evento errado"

**Given** qualquer validação
**When** a resposta é montada
**Then** é exatamente um de: válido / inválido / já utilizado / evento errado — nunca ambíguo, nunca mais de um

**Given** um usuário CLIENTE ou ORGANIZADOR
**When** tenta chamar o endpoint de validação (`POST /portaria/validacoes`)
**Then** rejeitado com `403`

**Given** a resposta de qualquer validação
**When** inspecionada
**Then** não inclui dado sensível do cliente além do necessário à operação (sem e-mail, sem telefone)

**Given** duas validações concorrentes do mesmo ingresso (cenário Testcontainers)
**When** disparadas ao mesmo tempo
**Then** exatamente uma retorna "válido" e a outra "já utilizado", garantido por constraint/lock de banco — `POST /portaria/validacoes` é o único lugar que transiciona `VALIDO → UTILIZADO` (AD-9)
