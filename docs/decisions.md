# Registro de decisões — Rolo 35

Log leve de decisões não-triviais tomadas durante a implementação. Alimenta as
seções de Uso de IA e Decisões técnicas do README final.

---

## [exemplo] Nome curto da decisão

- **Decisão**: o que foi decidido.
- **Por quê**: motivo ou trade-off considerado.

---

## Catálogo único — TMDb

- **Decisão**: usar só TMDb como fonte de catálogo, descartando Ticketmaster e a opção de integrar os dois.
- **Por quê**: preferência criativa — cinema como domínio permite mais refinamento dada a simplicidade, tem menor tempo de integração, e força modelagem própria (sessão, sala, assento, preço) em vez de herdar conceito pronto de API de eventos genérica, dando mais controle sobre o domínio.

---

## Mapa de assentos de cinema, não pista

- **Decisão**: reserva por mapa de assentos de cinema, descartando pista/quantidade e a opção de implementar os dois modelos.
- **Por quê**: é o ponto de maior complexidade de engenharia do projeto — exige modelagem de concorrência real (lock por assento individual) em vez de só decrementar um contador, o que faz mais sentido dentro do escopo cinema-only do projeto; implementar os dois modelos arriscava estourar o prazo de 7 dias.

---

## Java + Spring Boot

- **Decisão**: back-end em Java + Spring Boot, descartando Node e Python.
- **Por quê**: decisão segura — familiaridade prévia com Spring e Java, aceitando o trade-off de mais boilerplate que Node ou Python.

---

## Vite + React puro em vez de Next.js

- **Decisão**: front-end em Vite + React puro (SPA).
- **Por quê**: Next.js não se justifica pra baixa complexidade do projeto (SPA sem necessidade de SSR/rotas de servidor); Vite + React reduz a superfície mantendo o React exigido pelos requisitos do projeto.

---

## PostgreSQL + Flyway

- **Decisão**: Postgres como banco, Flyway pra migrations.
- **Por quê**: familiaridade e experiência prévia com ambos.

---

## Pagamento simulado por endpoint interno, sem sandbox real

- **Decisão**: endpoint interno determinístico, sem integrar sandbox de provedor real (Stripe test mode etc.), apesar dos requisitos permitirem.
- **Por quê**: economia de tempo no prazo de 7 dias — integrar sandbox real consome tempo que não se justifica agora. Candidato pra v2/v3, fora do escopo atual.

---

## JWT para autenticação

- **Decisão**: autenticação via JWT.
- **Por quê**: o papel de portaria sugere um cliente potencialmente separado (app/dispositivo dedicado na entrada); JWT se encaixa melhor nesse contexto que sessão/cookie, que pressupõe navegador único e mesmo domínio.

---

## Link de compartilhamento público sem login

- **Decisão**: link do ingresso é público, somente leitura, sem exigir login.
- **Por quê**: fidelidade literal ao requisito documentado; o risco extra de exposição pública é compensado pela regra de segurança contra uso duplicado do ingresso (lock/constraint) — o link não abre via de bypass.

---

## Deploy Render + Vercel, aceitando limitação de free tier

- **Decisão**: API no Render (free), front na Vercel; limitação documentada no README.
- **Por quê**: risco aceito conscientemente — mitigado no README, com possibilidade de upgrade pro plano pago do Render se necessário pra evitar cold start; Docker Compose cobrindo a aplicação inteira garante caminho alternativo de "sobe com um comando" se o deploy falhar.

---

## Identidade visual cinema 35mm anos 80/90

- **Decisão**: tema clássico de cinema anos 80/90 — paleta sépia/âmbar, vermelho veludo, dourado, tipografia marquise, perfuração de película como moldura.
- **Por quê**: gosto pessoal pela estética clássica de cinema da época; inspirou inclusive o nome do projeto ("rolo35", referência ao rolo de película 35mm).

---

## Estratégia de teste por camada, não Testcontainers universal

- **Decisão**: unitário / `@WebMvcTest` / Testcontainers restrito aos dois cenários de concorrência — não Testcontainers cobrindo tudo.
- **Por quê**: a ideia inicial era Testcontainers pra aplicação inteira, evitando bugs de produção no deploy; com o prazo curto, a divisão atual prioriza cobertura robusta nas partes críticas (concorrência) e cobertura mais simples nas de baixo risco. Se sobrar tempo, cobertura mais ampla continua sendo meta do projeto.

---

## Edição de sessão trava todos os campos após venda, sem exceção

- **Decisão**: sessão com ≥1 ingresso confirmado bloqueia edição de todos os campos — data, sala/capacidade, preço, título e sinopse — sem carve-out. Revisa uma decisão anterior do brief que deixava título/sinopse editáveis mesmo pós-venda.
- **Por quê**: título e sinopse vêm do catálogo TMDb, não de digitação livre do organizador — não existe cenário de "corrigir erro de digitação" que justifique deixá-los abertos. Permitir a troca depois da venda abriria uma brecha de fraude: vender ingresso pra um filme e substituir por outro depois que o cliente já pagou.

---

## Cadastro só obrigatório no momento da compra

- **Decisão**: cliente explora o catálogo de sessões e o mapa de assentos sem login; cadastro/autenticação como `CLIENTE` só é exigido ao reservar assento.
- **Por quê**: reduz fricção de descoberta — cliente vê disponibilidade real antes de decidir se cadastra. Nada sensível é exposto na exploração pública (sessão, sala, preço, disponibilidade de assento não são dado de outro usuário), e é o padrão de mercado (ingresso.com, eventim permitem navegação sem conta).

---

## Nenhum stretch priorizado — foco total no V1

- **Decisão**: dos três candidatos a stretch listados no brief (painel do organizador além do CRUD básico, busca/filtro avançado de eventos, mapa de assentos em tempo real via WebSocket), nenhum é priorizado agora. Ficam registrados como candidatos, sem compromisso de tempo.
- **Por quê**: com ~5 dias restantes no momento da decisão e a fatia vertical completa como prioridade central do projeto, qualquer tempo gasto em stretch antes do V1 rodar ponta a ponta e testado é risco de prazo não justificado — especialmente o WebSocket, que é o mais custoso e o de maior risco de estourar o cronograma.

---

## Fluxo de reserva: seleção do assento já é o hold, conflito volta ao mapa

- **Decisão**: selecionar um assento no mapa já cria o hold temporário de 10 minutos (não é uma etapa de "carrinho" separada da reserva). O mapa distingue três estados por assento — livre, reservado temporariamente, vendido/pago. Se dois clientes disputam o mesmo assento, quem perde a corrida recebe um erro claro e volta ao mapa de assentos da mesma sessão (não reinicia da escolha de sessão).
- **Por quê**: sem sincronização em tempo real no V1 (WebSocket é stretch não priorizado), o conflito de concorrência é inevitável na interface — o comportamento precisa ser explícito pra não virar bug de UX descoberto tarde. Manter o cliente na mesma sessão, só atualizando o mapa, é mais barato de implementar que preservar contexto de carrinho e menos confuso que reiniciar o fluxo inteiro.

---

## Empacotamento por domínio, não por camada técnica

- **Decisão**: pacotes Java organizados por domínio primeiro (`sessoes`, `reservas`, `pagamentos`, `ingressos`, `auth`), cada um contendo suas próprias camadas `controller/service/repository` — não um pacote `controller`/`service`/`repository` único guardando classes de todos os domínios. Camadas dentro de cada pacote de domínio seguem o non-negotiable já fixado no CLAUDE.md (controller → service → repository, sem regra de negócio no controller). Direção de dependência entre pacotes: `{pagamentos, ingressos} → reservas → sessoes → auth` (`A → B` = "A depende de B") — `auth` não depende de nenhum outro domínio, `pagamentos` depende de `reservas` (precisa travar/ler `Reserva` na confirmação de pagamento), `ingressos` depende de `reservas` e `pagamentos` — nunca o inverso.
- **Por quê**: com 6+ entidades caindo em ~5 áreas de domínio bem distintas e a prática de fatia vertical por feature (XP/TDD do projeto), empacotar por domínio mantém uma feature inteira dentro de um diretório — commits ficam localizados, revisão fica mais fácil, e reduz o risco de uma mudança de feature espalhar por três pacotes técnicos dispersos. A direção de dependência fixada evita que dois pacotes de domínio construídos em momentos diferentes acabem se importando um ao outro em ciclo.

---

## Camada `api/` dedicada no front, sem fetch direto em componente

- **Decisão**: SPA React acessa o back-end só através de uma camada `api/` própria — um módulo por domínio (`api/sessoes.ts`, `api/reservas.ts`, `api/pagamentos.ts`, `api/ingressos.ts`, `api/auth.ts`) exportando funções tipadas que encapsulam o `fetch`. Componente nunca chama `fetch` direto.
- **Por quê**: TypeScript estrito é non-negotiable do CLAUDE.md — fetch espalhado por componente arrisca cada tela inventar sua própria forma de tipar a resposta. Além disso, a camada central é o lugar natural pra anexar o JWT condicionalmente (rotas públicas vs autenticadas) e parsear o envelope de erro do back-end uma vez só, reaproveitado por toda tela — o que sustenta o NFR de loading/vazio/erro tratados em toda tela que busca dado. Espelha, um nível acima, a regra já fixada de que o back-end é fronteira exclusiva pro TMDb.

---

## Disponibilidade de assento: linha pré-criada por sessão + lock pessimista, TTL lazy

- **Decisão**: ao criar uma sessão, popula-se `assento_sessao` com uma linha por assento da sala (`status=LIVRE`), na mesma transação do insert da sessão — não "ausência de linha = livre". Reservar assentos adquire `SELECT ... FOR UPDATE` nas linhas pedidas (ordenadas por `assento_id`, evita deadlock entre reservas concorrentes) dentro de uma transação curta (sem chamada externa, com `lock_timeout` próprio); se qualquer assento não está disponível, a reserva inteira falha, sem hold parcial. TTL de 10 minutos não tem job agendado: todo lugar que lê ou escreve o estado de um assento calcula o status *efetivo* a partir de `expires_at` (um `RESERVADO` vencido é tratado como livre), nunca confiando no valor bruto da coluna.
- **Por quê**: FR-11 exige lock/constraint de banco, não checagem de aplicação — lock pessimista via `SELECT FOR UPDATE` é o padrão mais idiomático dado que o projeto já usa Spring Data JPA (evita cair pra SQL nativo de um UPSERT). Job agendado pra expirar reserva foi descartado porque o Render free dorme após 15min sem tráfego (o job não rodaria durante o sono) e o V1 não tem WebSocket/sync ao vivo — outro cliente só vê o estado atualizado ao consultar de novo, momento em que o cálculo lazy já resolve sozinho. `lock_timeout` curto evita que uma transação presa esgote o pool de conexão pequeno do Render free sob concorrência no mesmo assento.

---

## Conflito de horário na sala: sobreposição real com buffer fixo, não timestamp exato

- **Decisão**: criar uma sessão adquire lock pessimista na linha da `sala` e checa se alguma sessão existente pra essa sala se sobrepõe à janela `[data_hora, data_hora + 4h)` — sobreposição real de intervalo, não só colisão de timestamp idêntico.
- **Por quê**: sessão não modela duração/runtime do filme (o TMDb fornece, mas o snapshot local não captura); um buffer fixo de 4h cobre a duração de qualquer filme real + troca de sala sem precisar modelar runtime. Só checar timestamp exato deixaria passar duas sessões de fato sobrepostas na mesma sala com horários de início diferentes — furo real na proteção que a FR-6 pede (mesma classe de proteção da FR-11).

---

## Confirmação de pagamento: lock pessimista na reserva, sem estado "expirada" persistido, parâmetro no corpo

- **Decisão**: confirmar pagamento adquire `SELECT ... FOR UPDATE` na linha da `reserva` (mesmo padrão do assento). `reserva` só grava 3 estados — `ATIVA`, `CONFIRMADA`, `RECUSADA`; "expirada" não é persistido, é calculado (`ATIVA` + `expires_at` vencido) na hora da confirmação. Se o estado já não é `ATIVA`-não-vencida ao adquirir o lock, a chamada não reprocessa o parâmetro recebido — devolve o que já está persistido. Aprovado transiciona os assentos da reserva pra `VENDIDO`; recusado libera pra `LIVRE` imediatamente, na mesma transação. O parâmetro de teste que decide aprovação/recusa vai no corpo do POST (`resultadoSimulado`), não em query param ou header.
- **Por quê**: reaproveita o mesmo primitivo de lock já usado pro assento em vez de inventar mecanismo novo — mesma classe de problema de concorrência. Não persistir "expirada" evita um write path a mais sem necessidade (diferente do assento, ninguém mais "retoma" a reserva de outro cliente). Garantir que a chamada perdedora da corrida nunca reprocessa seu próprio parâmetro é o que fecha a FR-13 mesmo com parâmetros de teste conflitantes entre duas confirmações concorrentes. Corpo do POST porque é dado de negócio, não filtro nem metadado — valida com Bean Validation como qualquer DTO do domínio.

---

## Código do ingresso via HMAC (não JWT); rotas separadas pra link público e validação de portaria

- **Decisão**: código do ingresso é `uuid + "." + base64url(HMAC-SHA256(secret, uuid))`, onde `uuid` é a própria PK da linha `ingressos` — sem coluna própria de código, computado on-the-fly. `GET /ingressos/{codigo}` é pública, somente leitura, nunca muda estado; `POST /portaria/validacoes` exige papel `PORTARIA` + sessão selecionada e é a única rota que transiciona `VALIDO → UTILIZADO`, com o mesmo lock pessimista de linha usado no assento e na reserva.
- **Por quê**: HMAC gera um QR mais curto e simples que JWT, importante pra leitura confiável numa fila real de portaria — e como a validação sempre precisa ir ao banco pra checar o status mutável ("já utilizado"), duplicar `sessao_id` como claim de JWT não compraria nada, já que esse dado vem de graça na mesma consulta. Separar a rota de leitura pública da rota de validação é o que impede o link de compartilhamento virar bypass da portaria — non-negotiable explícito do CLAUDE.md.

---

## Autenticação SPA↔API: Bearer JWT em localStorage, sem cookie

- **Decisão**: token JWT transportado via header `Authorization: Bearer <token>`, guardado em `localStorage` no front. CORS no back com allow-list explícita de origens, sem `credentials`.
- **Por quê**: já decidido JWT em vez de sessão/cookie (ver decisão "JWT para autenticação" acima, pensando na portaria como cliente potencialmente separado) — isso já empurra pra bearer-token-em-header. Cookie cross-site (Vercel e Render são origens diferentes) exigiria `SameSite=None`+`Secure`+CORS credentials, trabalho de configuração extra que nenhum non-negotiable de segurança do projeto (XSS/CSRF não estão na lista) justifica.

---

## Sem tabela `filmes` própria — sessão guarda snapshot do TMDb

- **Decisão**: `sessoes` grava direto os campos do TMDb usados pela tela (`tmdb_id`, `titulo`, `poster_url`, `sinopse`, `data_estreia`) no momento da criação, em vez de referenciar uma tabela `filmes` separada.
- **Por quê**: nenhuma FR do V1 precisa de catálogo relacional local — FR-8 filtra direto em `sessoes`. Uma tabela e um join a menos sem nenhuma feature que os exija.

---

## Envelope de erro único via `GlobalExceptionHandler`

- **Decisão**: toda resposta de erro da API segue `{"codigo": "<ENUM_ESTAVEL>", "mensagem": "<texto>"}`, mapeada por um `GlobalExceptionHandler` (`@RestControllerAdvice`) central, com handler de fallback genérico (`500`, `codigo=ERRO_INTERNO`) pra qualquer exceção não mapeada.
- **Por quê**: sustenta o NFR de loading/vazio/erro tratado em toda tela (a camada `api/` do front parseia esse formato uma vez só) e evita que uma exceção não tratada vaze mensagem/stacktrace do Postgres/Hibernate na resposta — o que feriria o non-negotiable de não expor campo sensível de banco.

---

## TypeScript 6.x em vez da major mais recente (7.0)

- **Decisão**: fixar TypeScript 6.x no front, não a versão mais nova disponível (TypeScript 7.0, com compilador nativo em Go).
- **Por quê**: TS 7.0 tinha saído (GA) só 5 dias antes da verificação de stack desta arquitetura — cedo demais pra apostar numa reescrita de compilador sob prazo de 5 dias restantes, com risco real de fricção de tooling (plugins do ESLint, integração com Vite) recém-lançada. TS 6.x já está estável há meses.

---

## Design tokens do tema cinema 35mm definidos na Story 1.1, sem sessão de UX dedicada

- **Decisão**: em vez de rodar uma sessão de UX dedicada antes de começar a implementação, os tokens de cor e tipografia do tema (sépia/âmbar, vermelho veludo, dourado, tipografia marquise) foram fixados como valores concretos direto na Story 1.1 — via `@theme` do Tailwind 4 em `web/src/index.css` — no momento em que o front é re-scaffolded pra Vite+React. Paleta: `sepia-950 #14100d` a `sepia-700 #3b2a1a` (fundo/superfície), `amber-400 #d99a44` (destaque secundário), `velvet-700 #7a1220` / `velvet-600 #8c1c2c` (ação primária), `gold-500 #c9a227` (borda/foco), `cream-100 #f2e8d5` (texto sobre fundo escuro). Tipografia: `Bebas Neue` (título, estilo marquise) + `Lora` (corpo, serifada legível), self-hosted via `@fontsource`. Nenhum componente (moldura de perfuração, transição de contagem regressiva) construído junto — só os tokens.
- **Por quê**: o `epics.md` já tinha decidido não ter story de UX dedicada, tratando a identidade visual como requisito transversal de cada story de UI — reabrir isso com uma sessão de UX completa consumiria tempo do prazo de 7 dias sem ganho proporcional, já que o CLAUDE.md já descreve a direção qualitativa da paleta e tipografia. Definir os tokens concretos agora, no exato momento em que o Tailwind é configurado pela primeira vez, evita que cada tela futura hardcode cor solta e precise de retrabalho de retrofit quando o tema for aplicado depois. Fontes self-hosted (`@fontsource`) em vez de CDN do Google Fonts pra manter o build da SPA autocontido, sem round-trip de rede externa no boot.

---

## `RestClient` injetado via `spring-boot-starter-restclient`, não construído na mão

- **Decisão**: `TmdbClient` (proxy TMDb da Story 1.2) recebe `RestClient.Builder` por injeção de dependência padrão do Spring — construtor único, `TmdbClient(RestClient.Builder builder, @Value("${tmdb.api.token}") String apiToken)`. Isso exigiu adicionar a dependência `spring-boot-starter-restclient` ao `pom.xml`. Timeout de conexão/leitura configurado via propriedade padrão do Boot (`spring.http.clients.connect-timeout`/`spring.http.clients.read-timeout` em `application.properties`), não em código. Revisa uma primeira tentativa (dentro da mesma story, antes do commit) em que `TmdbClient` construía o próprio `RestClient` na mão, com dois construtores — um de produção, um package-private só pra permitir teste com `MockRestServiceServer` — justamente pra evitar essa dependência nova.
- **Por quê**: `spring-boot-starter-webmvc` traz a *classe* `RestClient` (via `spring-web`), mas não autoconfigura o *bean* `RestClient.Builder` — isso só vem do módulo `spring-boot-restclient`. A primeira tentativa evitou essa dependência, mas o custo disso foi maior que o benefício: código não-idiomático (dois construtores, um deles existindo só pra contornar teste), timeout hard-coded em vez de configurável por ambiente, e — o motivo decisivo — esse padrão de "construir `RestClient` na mão" teria que ser **reaprendido e reaplicado** em qualquer story futura que precise falar com uma segunda API externa, herdando a mesma gambiarra em vez de reusar um caminho padrão já resolvido pelo framework. `spring-boot-starter-restclient` é um módulo oficial do próprio Spring Boot (não uma lib terceira) — o custo real de adicioná-lo (uma linha no `pom.xml`, baixo risco de CVE/manutenção) é pequeno perto do ganho.

---

## `AssentoSessao` no pacote `sessoes`, não em `reservas` (Story 2.1)

- **Decisão**: `AssentoSessao`/`AssentoSessaoId`/`AssentoSessaoRepository` vivem em `br.com.rolo35.api.sessoes` (e `sessoes/repository`), não em `reservas` como o Structural Seed da Architecture Spine sugere pelo nome da tabela (`assento_sessao`).
- **Por quê**: AD-3 exige popular `assento_sessao` na mesma transação do insert de `sessoes` — isso é código do domínio `sessoes`. AD-1 fixa a direção de dependência como `reservas → sessoes` (nunca o inverso); se o repository vivesse em `reservas`, `sessoes` teria que depender de `reservas` só pra popular a tabela na criação da sessão, violando o grafo de dependência. Colocar a entidade onde ela é escrita primeiro — não onde parece "pertencer" conceitualmente pelo nome — é a única ordem que não viola AD-1; `reservas` (Epic 3) poderá chamar esse repository livremente depois, porque já depende de `sessoes`. Mesmo tratamento já dado ao pacote `sessoes.catalogo` na Story 1.2.

---

## `lock_timeout` por transação via `SET LOCAL` nativo, não hint JPA (Story 2.1)

- **Decisão**: `SessaoService.criar` emite `SET LOCAL lock_timeout = '3s'` via `EntityManager.createNativeQuery(...).executeUpdate()`, dentro da mesma transação `@Transactional` que faz o `SELECT ... FOR UPDATE` da sala — não usa o hint JPA `jakarta.persistence.lock.timeout`.
- **Por quê**: AD-5 pede um timeout próprio e curto pra essa transação de lock, sem depender de configuração global de `lock_timeout` do Postgres (que afetaria toda conexão do pool). `SET LOCAL` escopado à transação é a forma direta e sem ambiguidade de tradução Hibernate/driver — evita apostar que o hint JPA se traduz certo pra essa combinação de Hibernate 7.4/Spring Boot 4.1/Postgres sem verificação prévia. O que o teste de concorrência com Testcontainers (Story 2.1, Task 7) valida é o `SELECT ... FOR UPDATE`: trocando-o por um `findById` sem lock, o teste falha de forma determinística (2 sessões criadas em vez de 1), confirmando que a proteção é lock de banco real e não checagem isolada de aplicação. **O estouro do `lock_timeout` em si não é exercitado por teste** — com duas threads e transação de dezenas de ms, os 3s nunca são atingidos. O que o code review acrescentou foi o tratamento do desfecho: `PessimisticLockingFailureException` passou a ter handler dedicado (`503 SALA_OCUPADA`), porque antes ele caía no handler genérico e virava `500 ERRO_INTERNO` — um 500 opaco pra uma requisição válida que só perdeu a vez na fila.

---

## `GET /api/salas` sem FR própria — infraestrutura mínima pra AC1 funcionar ponta a ponta (Story 2.1)

- **Decisão**: endpoint `GET /api/salas` (autenticado, sem restrição de papel, sem CRUD) foi criado mesmo sem nenhuma FR do PRD pedir gestão de salas.
- **Por quê**: sem ele, a tela de criação de sessão do organizador teria que hardcodar `salaId=1` — código morto/fake que quebraria silenciosamente no dia em que uma segunda sala fosse semeada. É só a infraestrutura mínima real pra AC1 (Story 2.1) funcionar de ponta a ponta pela UI, não abre escopo novo de gestão de salas.

---

## Fix incidental: `MethodArgumentNotValidException` sem handler dedicado (Story 2.1)

- **Decisão**: `GlobalExceptionHandler` passou a agrupar `MethodArgumentNotValidException` no mesmo handler de `PARAMETRO_INVALIDO` (`400`), junto com `ParametroInvalidoException` e `MissingServletRequestParameterException`.
- **Por quê**: antes da Story 2.1, qualquer falha de `@Valid` em qualquer DTO do projeto (inclusive `LoginRequest`, já existente desde a Story 1.1) caía no handler genérico `Exception.class` e virava `500 ERRO_INTERNO` em vez de `400` — um bug latente que nunca tinha sido exercitado porque nenhum DTO anterior tinha validação de campo capaz de falhar via `@Valid` de um jeito que chegasse até esse ponto. `CriarSessaoRequest` é o primeiro DTO da Story 2.1 com validação de verdade (`@NotNull`/`@NotBlank`/`@Positive`), então o gap ficou visível durante o RED da Task 4 — o handler novo corrige os dois casos de uma vez. Mudança puramente aditiva, sem regressão, registrada aqui porque o blast radius toca o domínio `auth` de raspão.

---

## Fuso horário fixado por variável de ambiente, não por conversão no código (Story 2.1, code review)

- **Decisão**: `TZ=America/Sao_Paulo` no `Dockerfile` da API, nos dois serviços do `docker-compose.yml` e documentado no `.env.example` pra ser configurado também no Render. `sessoes.data_hora` continua `LocalDateTime`/`TIMESTAMP` sem zona, e o front continua enviando a string local do `<input type="datetime-local">` sem conversão.
- **Por quê**: o back-end comparava `request.dataHora()` (wall-clock do navegador do organizador) com `LocalDateTime.now()` (fuso default do JVM). Em dev os dois coincidem; em produção o container roda em UTC, então uma sessão marcada para hoje às 20:00 em BRT era comparada com 23:00 e rejeitada como `DATA_HORA_NO_PASSADO` — toda a janela das próximas ~3h ficava inacessível, e o mesmo desvio deslocava o buffer de 4h. Alinhar os três relógios por configuração é uma linha; a alternativa correta em multi-timezone (front converte pra UTC, entidade vira `Instant`, coluna vira `TIMESTAMPTZ`) mexeria em schema, DTO, front e toda a suíte, sem ganho real pra um produto de cinema que opera num fuso só. A premissa aceita — operação single-timezone — fica registrada aqui em vez de implícita. `SessaoServiceTest.aceitaDataHoraPoucasHorasAFrenteDoRelogioLocal` é a guarda de regressão: quem trocar a comparação por uma referência em UTC quebra o teste.

---

## Papel checado por `@PreAuthorize` no método, não por matcher de path (Story 2.1, code review)

- **Decisão**: `@EnableMethodSecurity` em `SecurityConfig` e `@PreAuthorize("hasRole('ORGANIZADOR')")` em `SessaoController.criar`. O `requestMatchers(POST, "/api/sessoes").hasRole("ORGANIZADOR")` foi removido; `SecurityConfig` decide só autenticação (`permitAll` no login/health, `authenticated` no resto).
- **Por quê**: a regra presa à string exata `POST /api/sessoes` deixava todo o resto de `/api/sessoes/**` caindo no `anyRequest().authenticated()`. Na prática, o `PUT /api/sessoes/{id}` da Story 2.2 e o `GET` de listagem da 2.3 nasceriam abertos a CLIENTE e PORTARIA sem nenhum teste falhar — a proteção dependia de alguém lembrar de editar `SecurityConfig` a cada rota nova. Com a regra ao lado do endpoint, rota sem anotação não herda permissão por acidente. Efeito colateral que precisou de tratamento: `@PreAuthorize` nega **dentro** do `DispatcherServlet`, então a `AccessDeniedException` chega no `@RestControllerAdvice` em vez de passar pelo `RestAccessDeniedHandler` — sem um handler dedicado viraria `500`. Os dois caminhos (negação na filter chain e negação no método) agora devolvem o mesmo envelope `403 NAO_AUTORIZADO`.

---

## Capacidade derivada do mapa de assentos, não de `linhas × colunas` (Story 2.1, code review)

- **Decisão**: `SessaoService` calcula `capacidade = assentos.size()` a partir de `assentoRepository.findBySalaId(...)`, e rejeita com `SalaSemAssentosException` (`409 SALA_SEM_ASSENTOS`) uma sala sem mapa cadastrado.
- **Por quê**: a versão anterior usava `sala.getLinhas() * sala.getColunas()` enquanto as linhas de `assento_sessao` vinham de `findBySalaId` — duas fontes independentes, sem constraint no schema ligando as dimensões da sala à contagem em `assentos`. Uma sala com dimensões declaradas mas mapa incompleto criaria a sessão anunciando "capacidade 40" com menos (ou zero) assentos vendáveis, e o defeito só apareceria no mapa de assentos da Epic 3. A AC1 pede literalmente capacidade "derivada do mapa de assentos da sala" — é o mapa que determina quantos ingressos existem pra vender.

---

## `AssentoSessao` implementa `Persistable` (Story 2.1, code review)

- **Decisão**: `AssentoSessao` implementa `Persistable<AssentoSessaoId>` com flag `@Transient novo`, marcada `false` em `@PostPersist`/`@PostLoad`. O `@Builder` do Lombok saiu; o service usa o construtor explícito.
- **Por quê**: com `@EmbeddedId` atribuído em código, o `isNew()` padrão do Spring Data olha só pro id não-nulo e conclui "já existe" — o `saveAll` vira `merge()`, que dispara um `SELECT` por linha antes de cada `INSERT`. Pra "Sala 1" isso são 40 selects + 40 inserts **dentro da transação que segura o lock pessimista da sala**, exatamente o oposto do que AD-5 pede (transação de lock a mais curta possível) e o padrão N+1 que os non-negotiables proíbem. Escala linear com o tamanho da sala: uma sala de 300 lugares seriam 600 statements sob lock, aumentando a chance de o `lock_timeout` de 3s estourar em quem está na fila.

---

## Sem coluna `publicada`/estado de rascunho em `sessoes` (Story 2.3)

- **Decisão**: `listarPublicadas()` lista todas as linhas de `sessoes`, sem filtro de status — não existe (nem foi adicionada) coluna de publicação/rascunho na tabela.
- **Por quê**: `V1__schema.sql` nunca teve esse campo, e nenhuma AC de nenhuma story até aqui pediu um fluxo de rascunho — toda sessão criada pela Story 2.1 já é, por definição, listável publicamente. Inventar uma coluna/flag nova pra esta story seria escopo não solicitado; se um fluxo de rascunho vier a ser pedido depois, é decisão de uma story futura, não uma antecipação silenciosa agora.

---

## Listagem pública: uma query nativa com `JOIN`+`GROUP BY`, não duas consultas (Story 2.3)

- **Decisão**: `SessaoRepository.listarPublicadas()` é uma única `@Query(nativeQuery = true)` que junta `sessoes`+`salas`+`assentos`+`assento_sessao` via `JOIN`/`LEFT JOIN` e agrega `capacidade` (`COUNT(DISTINCT a.id)`) e `assentosLivres` (`COUNT(DISTINCT CASE WHEN status='LIVRE' ...)`) num `GROUP BY s.id, sa.nome`. O booleano `esgotada` é calculado no `SessaoService` (`assentosLivres == 0`), não na query nem persistido — o DTO público (`SessaoListagemDto`) não expõe a contagem crua de assentos livres, só o booleano derivado.
- **Por quê**: a AC2 desta story exige "uma única consulta (projection/fetch join)", mesmo padrão de estilo já usado em `SessaoRepository.existeConflitante` (Story 2.1) — `@Query` nativa com agregação em SQL, não fetch join JPQL, porque o `CASE WHEN` + `COUNT DISTINCT` correlacionado não é natural em JPQL sem subquery, o que reintroduziria risco de N+1 dependendo de como o Hibernate traduz. Não expor `assentosLivres` bruto evita que um visitante estime quantos ingressos já foram vendidos de uma sessão — informação sem valor pro caso de uso e desnecessária de vazar.

---

## Listagem pública esconde sessões passadas (code review da Story 2.3)

- **Decisão**: `listarPublicadas()` ganhou `WHERE s.data_hora >= now()`, dentro da mesma query nativa — sessão já ocorrida some da listagem pública.
- **Por quê**: nenhuma AC original da Story 2.3 pedia filtro temporal (só status esgotada/vaga), mas sem ele a listagem acumularia toda sessão já ocorrida pra sempre — "Sessões em cartaz" misturaria filmes de meses atrás com os futuros, indefinidamente, sem nenhuma forma de esconder o que já passou. Levantado no code review adversarial da story (Blind Hunter + Edge Case Hunter, achado independente pelos dois); usuário decidiu corrigir na hora em vez de deferir. Filtro na própria query nativa mantém a garantia de uma única consulta (AC2), sem segunda chamada nem filtro em memória.

---
