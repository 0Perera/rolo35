---
baseline_commit: 3c33fcf
---

# Story 1.2: Busca de Filmes via Proxy TMDb

Status: review

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a usuário autenticado (tipicamente organizador, na hora de criar sessão),
I want buscar filmes em cartaz por título,
so that eu escolho qual filme vincular a uma sessão sem nunca falar direto com o TMDb.

## Acceptance Criteria

1. **Given** uma chave TMDb válida configurada via variável de ambiente no back-end **When** `GET /api/filmes/buscar?query={termo}` é chamado com um termo válido **Then** o back-end faz proxy pro TMDb e retorna só os campos que a tela precisa (título, pôster, sinopse, data de estreia) — a chave TMDb nunca aparece na resposta nem em nenhum header exposto ao client.

2. **Given** o bundle do front-end **When** inspecionado (build de produção) **Then** a chave TMDb não existe em nenhum arquivo servido ao client — a chamada ao TMDb é responsabilidade exclusiva do back-end.

3. **Given** uma busca sem resultados **When** a tela de busca recebe a resposta **Then** mostra estado de lista vazia, não um erro.

4. **Given** o TMDb fora do ar ou respondendo com timeout **When** a busca é feita **Then** a tela mostra estado de erro claramente distinto do estado de lista vazia, sem travar em carregamento.

5. **Given** a busca em andamento **When** a requisição ainda não retornou **Then** a tela mostra estado de carregamento.

6. **Given** a chave TMDb ausente ou inválida na configuração do back-end **When** o endpoint de busca é chamado **Then** retorna erro controlado via envelope `{codigo, mensagem}`, sem vazar detalhe da resposta bruta do TMDb.

## TDD — regra obrigatória desta story

> Regra única do projeto (CLAUDE.md § Metodologia XP + TDD): **todo teste nasce antes do código**, sempre. Não existe "implementar tudo e testar no final" — cada subtask de código abaixo é precedida da sua subtask de teste, marcada **[RED]**. O ciclo dentro de cada par é: escrever o teste, rodar e ver falhar por ausência do código (RED) → escrever o código mínimo que faz passar (**[GREEN]**) → refactor se necessário, mantendo os testes verdes. Não pule o RED — se o código já existir antes do teste, o teste deixou de validar alguma coisa. A única exceção documentada no projeto é a UI de interação visual (Task 4 abaixo), cujo teste de contrato nasce **depois** do componente, por decisão explícita já registrada no CLAUDE.md (cobertura leve, focada em contrato, não em renderização) — todo o resto segue RED→GREEN sem exceção.

## Tasks / Subtasks

- [x] **Task 1 — Proxy TMDb no back-end (AC: 1, 2, 6)**
  - [x] Config (sem teste, é infraestrutura): adicionar `TMDB_API_KEY` ao `.env.example` (comentário explicando que é o **API Read Access Token** v4 do TMDb, não a `api_key` v3 legada — ver Dev Notes) e ao `docker-compose.yml` (`environment` do serviço `api`); `application.properties`: `tmdb.api.token=${TMDB_API_KEY:}` — **sem fallback de dev-conveniência** (mesmo padrão já adotado pra `JWT_SECRET` após a revisão de código da Story 1.1: segredo real, sem valor fake que finja funcionar)
  - [x] **[RED]** Escrever teste unitário de `TmdbClient` (JUnit/Mockito, sem contexto Spring — usar `MockRestServiceServer` ou mock do `RestClient`) cobrindo: mapeia resposta do TMDb pra `FilmeDto` (`poster_path` null → `posterUrl` null; `release_date` vazio → `dataEstreia` null); lança `CatalogoIndisponivelException` quando `tmdb.api.token` está em branco; lança `CatalogoIndisponivelException` quando o TMDb responde erro HTTP (401/5xx) ou timeout. Rodar e confirmar que falha por `TmdbClient`/`FilmeDto`/`CatalogoIndisponivelException` ainda não existirem.
  - [x] **[GREEN]** Criar pacote `br.com.rolo35.api.sessoes.catalogo` (Capability Map da Architecture Spine: `sessoes/catalogo/`, AD-14) com `FilmeDto` (record: `tmdbId` Long, `titulo`, `posterUrl` nullable, `sinopse`, `dataEstreia` nullable — inclui `tmdbId` mesmo fora da lista literal da AC 1, porque sem ele o organizador não referencia o filme escolhido na criação de sessão da Story 2.1/FR-5/AD-14) e `CatalogoIndisponivelException`. Implementar `TmdbClient` com `RestClient` do Spring (já disponível via `spring-boot-starter-webmvc`, sem dependência nova — ver Dev Notes/Latest Tech): base URL `https://api.themoviedb.org/3`, timeout curto (`connectTimeout` ~5s, `readTimeout` ~8s via `ClientHttpRequestFactorySettings`), autentica com `Authorization: Bearer {token}` (header, nunca `api_key` na query string). Método `buscarPorTitulo(query)` chama `GET /search/movie?query={query}&language=pt-BR`, mapeia `results` pra `List<FilmeDto>` (`id`→`tmdbId`, `title`→`titulo`, `poster_path`→`https://image.tmdb.org/t/p/w500{poster_path}` ou `null`, `overview`→`sinopse`, `release_date`→`dataEstreia`). Rodar o teste até passar.
  - [x] **[RED]** Escrever teste `@WebMvcTest` de `FilmeController` com `TmdbClient` mockado: `GET /api/filmes/buscar?query=...` → `200` + lista de filmes pra busca válida (AC 1); `200` + lista vazia pra busca sem resultado (AC 3, o controller só repassa o array vazio); `502` + envelope `{codigo: "CATALOGO_INDISPONIVEL", ...}` quando `TmdbClient` lança a exceção (AC 4, AC 6); resposta serializada nunca inclui `tmdb.api.token` nem qualquer campo de chave (AC 1). Rodar e confirmar que falha por `FilmeController` e o handler novo ainda não existirem.
  - [x] **[GREEN]** Implementar `FilmeController` (`GET /api/filmes/buscar`) e adicionar `@ExceptionHandler(CatalogoIndisponivelException.class)` no `GlobalExceptionHandler` existente → `502` + `ApiError("CATALOGO_INDISPONIVEL", "Catálogo de filmes indisponível no momento")`. Rodar o teste até passar.

- [x] **Task 2 — Autorização do endpoint (sem código, sem teste novo — documentar a decisão)**
  - [x] Confirmar (por inspeção, não por teste novo) que `SecurityConfig` não precisa de alteração: `/api/filmes/buscar` não está na allow-list (`/api/auth/login`, `/actuator/health`), então já cai em `anyRequest().authenticated()` — qualquer papel autenticado acessa. Isso já é coberto pelos testes de segurança existentes da Story 1.1 (`JwtAuthenticationFilterTest`) — nenhum teste novo é necessário porque nenhum comportamento novo foi introduzido nesta camada.

- [x] **Task 3 — Camada `api/` no front: Authorization automático + módulo de filmes (AC: 1)**
  - [x] **[RED]** Escrever teste unitário de `apiFetch` (vitest, `web/src/api/client.test.ts` — arquivo novo, não existe teste pra `client.ts` ainda) cobrindo: anexa `Authorization: Bearer <token>` no header quando existe `rolo35.token` no `localStorage`; **não** anexa o header quando não existe token (login segue funcionando sem header). Mockar `fetch` global. Rodar e confirmar que falha (comportamento ainda não implementado).
  - [x] **[GREEN]** Atualizar `web/src/api/client.ts` (arquivo existente): `apiFetch` passa a ler `rolo35.token` do `localStorage` e anexar `Authorization: Bearer <token>` condicionalmente — é a implementação real da promessa da AD-2 ("anexa Authorization condicionalmente... num único lugar") que a Story 1.1 documentou mas não chegou a exercitar (login é a única chamada até aqui, e é pública). Rodar o teste até passar.
  - [x] Criar `web/src/api/filmes.ts`: `buscarFilmes(query: string)` tipado, `GET /api/filmes/buscar?query=${encodeURIComponent(query)}`, retorna `Filme[]` (mesmos campos do `FilmeDto`, em camelCase — Jackson já serializa assim). Wrapper simples sem lógica própria (mesmo padrão de `auth.ts`) — sem teste unitário dedicado; é exercitado indiretamente pelo teste de contrato de `BuscaFilmesPage` (Task 4).

- [x] **Task 4 — Tela de busca de filmes (AC: 3, 4, 5) — exceção documentada: teste nasce depois do componente**
  - [x] Implementar `web/src/pages/BuscaFilmesPage.tsx`: campo de busca (submit) + lista de resultados (pôster, título, sinopse, data de estreia). Estados via `useState` (mesmo padrão de `LoginPage.tsx`): `idle` (nada buscado ainda) → `loading` → resultado (lista com itens, ou mensagem de "nenhum filme encontrado" se vazia — não é erro) → `error` (mensagem distinta, ex. "não foi possível buscar filmes agora"). Usa os design tokens já definidos na Story 1.1 (`bg-sepia-950`, `font-display`, `text-amber-300`, `border-gold-500`, etc.) — sem inventar cor nova.
  - [x] Trocar a rota `/organizador` em `web/src/App.tsx`: de `<PapelPlaceholderPage titulo="Área do Organizador" />` pra `<BuscaFilmesPage />` — é o papel que a story associa à busca; `/cliente` e `/portaria` continuam com o placeholder (fora de escopo desta story).
  - [x] **Depois** do componente pronto: teste de contrato `BuscaFilmesPage.test.tsx` (vitest + testing-library, mesmo padrão de `LoginPage.test.tsx`) — submit chama `api/filmes.ts` com o termo digitado; mostra estado de carregamento enquanto a promise não resolve; mostra lista vazia (não erro) quando a resposta é `[]`; mostra estado de erro distinto quando a chamada rejeita. Foco em contrato de comportamento, não em detalhe de renderização/CSS.

- [x] **Task 5 — Confirmação final (sem código, checklist de saída)**
  - [x] Rodar a suíte completa (back-end `mvn test`, front `npm test`) e confirmar tudo verde
  - [x] Sem cenário de Testcontainers nesta story — não há escrita no banco nem concorrência aqui (tabela do projeto: Testcontainers reservado pros dois cenários de concorrência + smoke test de repository, nenhum dos dois se aplica à busca de filme)

### Review Findings

Code review adversarial (Blind Hunter + Edge Case Hunter + Acceptance Auditor) rodada em `3c33fcf..HEAD`. 4 achados corrigidos nesta mesma sessão (patch aplicado + teste), 6 adiados por não bloquearem o funcionamento — detalhe de cada um em `deferred-work.md`.

- [x] [Review][Patch] `BuscaFilmesPage` não limpava `resultados` ao iniciar/errar uma nova busca — lista de uma busca anterior bem-sucedida ficava visível junto com o erro da busca seguinte, violando a AC 4 ("estado de erro claramente distinto") num fluxo real não coberto pelo teste original [`web/src/pages/BuscaFilmesPage.tsx:14`] — corrigido com `setResultados(null)` no início de `handleSubmit`; 2 testes novos em `BuscaFilmesPage.test.tsx`.
- [x] [Review][Patch] `FilmeController` aceitava `query` ausente (500 genérico) ou em branco (200 com busca vazia repassada ao TMDb) sem validação [`api/src/main/java/br/com/rolo35/api/sessoes/catalogo/FilmeController.java:18`] — corrigido com checagem de `isBlank()` + `ParametroInvalidoException` nova, e handler pra `MissingServletRequestParameterException`/`ParametroInvalidoException` → `400 PARAMETRO_INVALIDO` em `GlobalExceptionHandler`; 2 testes novos em `FilmeControllerTest`.
- [x] [Review][Patch] `TmdbClient.buscarPorTitulo` descartava a `RestClientException` original no `catch` sem logar nada — em produção, impossível distinguir timeout de erro 401/5xx do TMDb pelos logs [`api/src/main/java/br/com/rolo35/api/sessoes/catalogo/TmdbClient.java:46`] — corrigido com `log.warn(...)` (SLF4J) antes de lançar `CatalogoIndisponivelException`, incluindo a exceção original pro stacktrace.
- [x] [Review][Patch] `TmdbClient.java` sem newline no fim do arquivo — cosmético, corrigido junto com o item acima.
- [x] [Review][Defer] `spring.http.clients.connect-timeout`/`read-timeout` são propriedades globais do Spring Boot — qualquer `RestClient`/`RestTemplate` autoconfigurado que vier a existir no projeto herda silenciosamente o timeout 5s/8s pensado pro TMDb [`api/src/main/resources/application.properties`] — deferido, revisitar se uma segunda integração de API externa precisar de timeout diferente.
- [x] [Review][Defer] `TmdbMovieResult` não valida `id`/`title` nulos vindos do TMDb (enquanto `posterPath`/`releaseDate` têm guarda explícita) [`api/src/main/java/br/com/rolo35/api/sessoes/catalogo/TmdbClient.java:63-68`] — deferido, contrato do TMDb pra esses dois campos é estável na prática; revisitar se algum filme real disparar `tmdbId: null` no front.
- [x] [Review][Defer] AC 2 (chave TMDb nunca no bundle) não tem verificação automatizada/CI — só checagem manual feita uma vez nesta sessão (`grep` no bundle de produção) — deferido, considerar um passo de build+grep no CI se o projeto ganhar pipeline de CI.
- [x] [Review][Defer] Pacote `sessoes.catalogo` não segue literalmente o padrão `controller/service/repository` que o CLAUDE.md lista como non-negotiable de camadas — decisão já registrada nos Dev Notes desta story, mas diverge do texto literal do non-negotiable — deferido, revisitar se o CLAUDE.md for atualizado pra abrir exceção explícita a pacotes finos feito este.
- [x] [Review][Defer] `docs/decisions.md` (entrada "RestClient injetado...") descreve a tentativa anterior como "antes do commit" — impreciso após a reconstrução do histórico em commits separados (a versão com dois construtores foi de fato commitada em `45dd91b`, revertida só no `refactor` seguinte) — deferido, ajuste de texto cosmético.
- [x] [Review][Defer] `key={filme.tmdbId}` em `BuscaFilmesPage` assume unicidade de `tmdbId` no array de resultados, nunca verificada contra a resposta real do TMDb — deferido, risco baixo, revisitar só se o React acusar warning de key duplicada em uso real.

## Dev Notes

- **Por que `sessoes/catalogo/` e não um pacote `filmes/` novo:** a Architecture Spine já reserva esse caminho explicitamente na Capability Map (`§4.2 Catálogo de Filmes (FR-4) | sessoes/catalogo/ | AD-14`) e no Structural Seed (`sessoes/catalogo/ # TmdbClient — proxy exclusivo TMDb`). O domínio `sessoes` em si (entidade `Sessao`, `SessaoController/Service/Repository`) só nasce na Story 2.1 — esta story cria só o subpacote `catalogo/` dentro dele, o que é esperado (o pacote de domínio vai crescendo por story, não tudo de uma vez).

- **Autenticação TMDb — Bearer token, não `api_key` na query string:** pesquisa na doc oficial do TMDb (2026-08-10) confirma que o método recomendado hoje é o **API Read Access Token** (v4) enviado via header `Authorization: Bearer <token>`, em vez do parâmetro legado `?api_key=`. Motivo prático além de "é o recomendado": query params tendem a acabar em log de acesso (proxy, load balancer, APM) — header evita esse vetor de vazamento acidental da chave, reforçando a AC 1 de "a chave nunca aparece em nenhum header exposto ao client" (aqui é o inverso: nunca vazar no lado do back-end que fala com o TMDb).

- **`RestClient` do Spring, sem dependência nova:** o projeto já tem `spring-boot-starter-webmvc` no `pom.xml` (Story 1.1), que traz `spring-web` — `RestClient` (desde Spring Framework 6.1, presente no Spring Boot 4.1 usado aqui) já está disponível. Não é necessário adicionar WebClient/webflux nem nenhum cliente HTTP externo (RestTemplate, OkHttp) só pra isso.

- **Endpoint TMDb usado — busca geral por título, não "now playing":** a FR-4 do PRD (fonte de verdade da AC) pede "busca filmes por título", não filtro de cartaz atual. O TMDb não tem um endpoint único que combine busca textual + filtro "em cartaz" — `/search/movie` é o único que aceita `query`. Por isso o proxy usa `/search/movie` puro; "filmes em cartaz" no README/CLAUDE.md é o contexto de domínio geral do projeto, não uma AC testável desta story especificamente.

- **`language=pt-BR` na chamada ao TMDb:** decisão pragmática, não uma AC — o produto e a comunicação do projeto são em português brasileiro, então localizar título/sinopse na resposta do TMDb (quando disponível) evita retrabalho de tradução manual. Não quebra a AC 3 (lista vazia continua vazia independente do idioma).

- **`CatalogoIndisponivelException` cobre dois cenários com um mecanismo só (AC 4 + AC 6):** token ausente/em branco E erro/timeout do TMDb viram o mesmo tipo de exceção, mapeada pro mesmo código de erro (`CATALOGO_INDISPONIVEL`, `502`). Do ponto de vista do cliente da API, "não consigo te dar dados de filme agora" é o mesmo problema nos dois casos — não há motivo prático pra distinguir com dois códigos, e simplifica o `GlobalExceptionHandler` (que já tem o precedente de um handler por tipo de exceção, criado na Story 1.1).

- **`GET /api/filmes/buscar` cai no `anyRequest().authenticated()` já existente:** nenhuma mudança em `SecurityConfig.java` é necessária — a allow-list (`/api/auth/login`, `/actuator/health`) já é a exceção explícita à regra "autenticado por padrão" fixada na Story 1.1 (AD-10, non-negotiable "toda rota valida papel no back-end"). Esta story não introduz restrição de papel (`hasRole`) porque a AC não pede isso — "tipicamente organizador" no texto da story é contexto de uso, não uma regra de autorização a testar.

- **`client.ts` ganha o Authorization automático nesta story, não na 1.1:** a Story 1.1 já documentava a promessa da AD-2 ("anexa Authorization condicionalmente... num único lugar") mas não tinha nenhum endpoint autenticado pra exercitar isso (login é público). Esta é a primeira chamada autenticada do front — implementar o anexo automático de `Authorization: Bearer <token>` a partir do `localStorage` dentro do próprio `apiFetch` (não como parâmetro opcional por chamada) é o que cumpre literalmente "num único lugar": toda chamada futura de qualquer domínio (`sessoes`, `reservas`, `pagamentos`, `ingressos`) herda o comportamento de graça, sem repetir lógica de header em cada módulo `api/*.ts`.

- **Envelope de erro (AD-11):** `CATALOGO_INDISPONIVEL` é um código novo, consistente com a lista "não exaustiva" já prevista na Architecture Spine (`ASSENTO_INDISPONIVEL`, `RESERVA_EXPIRADA`, ... "cada story pode adicionar o seu"). Sem mudança na estrutura do `GlobalExceptionHandler`/`ApiError`, só um `@ExceptionHandler` novo.

- **Consumo futuro do `tmdbId`:** a Story 2.1 (Criação de Sessão) vai precisar do `tmdbId` retornado aqui pra montar o snapshot de `sessoes` (`tmdb_id, titulo, poster_url, sinopse, data_estreia` — AD-14). Incluir `tmdbId` no `FilmeDto` agora evita ter que voltar nesta story depois.

- **AC 2 (chave nunca no bundle do front) não tem task própria porque é garantida por design, não por um mecanismo a implementar:** a chave TMDb só é lida em `application.properties`/`TmdbClient`, do lado do back-end; `web/src/api/filmes.ts` só fala com `/api/filmes/buscar` (o próprio back-end), nunca com `api.themoviedb.org`. Não existe nenhuma variável `VITE_*` de chave TMDb pra vazar no bundle (variáveis `VITE_*` são as únicas que o Vite injeta no client). Se, ao implementar, surgir qualquer necessidade de referenciar a chave no front, isso é um sinal de desvio da arquitetura — pare e reavalie antes de prosseguir.

- **Estado atual confirmado do que esta story vai tocar (relido no momento da criação desta story, já refletindo a revisão de código da Story 1.1):** `application.properties` já tem `security.jwt.secret=${JWT_SECRET}` sem fallback e `cors.allowed-origins=${CORS_ALLOWED_ORIGINS:http://localhost:5173}`; `SecurityConfig.java` já lê `corsAllowedOrigins` via `@Value("${cors.allowed-origins}")` em vez de lista hardcoded — nenhum dos dois muda nesta story, só reafirma o padrão de "segredo real sem fallback" que `tmdb.api.token` replica. `client.ts`, `GlobalExceptionHandler.java`, `ApiError.java` e `App.tsx` estão no estado descrito nas subtasks acima (conteúdo integral relido antes de escrever esta story).

### Project Structure Notes

- Segue a estrutura já fixada na Architecture Spine (§ Structural Seed, § Capability → Architecture Map) — sem variância detectada.
- Back-end (novo): `api/src/main/java/br/com/rolo35/api/sessoes/catalogo/{TmdbClient.java, FilmeDto.java, FilmeController.java, CatalogoIndisponivelException.java}`. Pacote raiz continua `br.com.rolo35.api.*` (mesma observação já registrada na Story 1.1).
- Back-end (update): `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` ganha um handler novo; `api/src/main/resources/application.properties` ganha `tmdb.api.token`.
- Front-end (novo): `web/src/api/filmes.ts`, `web/src/api/client.test.ts`, `web/src/pages/BuscaFilmesPage.tsx`, `web/src/pages/BuscaFilmesPage.test.tsx`.
- Front-end (update): `web/src/api/client.ts` (Authorization automático), `web/src/App.tsx` (rota `/organizador` passa a renderizar `BuscaFilmesPage`).
- Config (update): `.env.example` e `docker-compose.yml` ganham `TMDB_API_KEY`.
- **Leitura obrigatória antes de codar** (arquivos UPDATE, não criar do zero): `web/src/api/client.ts`, `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` e `ApiError.java`, `web/src/App.tsx`, `api/src/main/resources/application.properties`, `.env.example` e `docker-compose.yml` — todos já lidos por completo durante a criação desta story (estado pós-revisão de código da Story 1.1), conteúdo atual descrito em Dev Notes acima.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Busca de Filmes via Proxy TMDb]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-11, AD-12, AD-14, Capability → Architecture Map §4.2, Structural Seed]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#FR-4]
- [Source: CLAUDE.md — Metodologia XP + TDD, Regra da API externa (TMDb), Non-negotiables de Segurança e Interface]
- [Source: docs/decisions.md — "Camada api/ dedicada no front, sem fetch direto em componente", "Envelope de erro único via GlobalExceptionHandler"]
- [Source: _bmad-output/implementation-artifacts/1-1-fundacao-e-login-com-papel-fixo.md — padrões de `client.ts`, `GlobalExceptionHandler`, `SecurityConfig`, design tokens, estrutura de teste de página (`LoginPage.test.tsx`), commits de revisão de código (JWT_SECRET sem fallback, CORS configurável)]
- Pesquisa web (2026-08-10): TMDb API — autenticação recomendada via `Authorization: Bearer <API Read Access Token>` (v4) em vez de `?api_key=` (v3 legado) — [Application Level Authentication](https://developer.themoviedb.org/docs/authentication-application), [Search & Query For Details](https://developer.themoviedb.org/docs/search-and-query-for-details).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Investigação de compatibilidade Spring Boot 4.1/Jackson 3 antes de codar `TmdbClient`: confirmado via inspeção de jars em `~/.m2` que `jackson-core`/`jackson-databind` migraram pro namespace `tools.jackson.*` (Jackson 3), mas `jackson-annotations` permanece em `com.fasterxml.jackson.annotation` (2.x) — `@JsonProperty` usa o pacote antigo.
- `mvn dependency:tree` confirmou que `spring-boot-starter-webmvc` **não** traz `spring-boot-restclient`/`spring-boot-starter-restclient` transitivamente — não existe bean `RestClient.Builder` autoconfigurado no contexto por padrão. Primeira tentativa: `TmdbClient` construía o próprio `RestClient.Builder` na mão (dois construtores, um deles package-private só pro teste), pra evitar dependência nova. Revisado em seguida (ver decisão "RestClient injetado via `spring-boot-starter-restclient`" em `docs/decisions.md`): a dependência foi adicionada e `TmdbClient` voltou a ter um único construtor com `RestClient.Builder` injetado — motivo: custo de adicionar um módulo oficial do próprio Spring Boot é baixo, contra o ganho de eliminar o padrão de dois construtores e herdar timeout configurável por `application.properties`.
- Timeout: tentativa inicial via `SimpleClientHttpRequestFactory.setConnectTimeout/setReadTimeout(Duration)` codificado na mão (`ClientHttpRequestFactorySettings`, citada no Dev Notes original da story, não existe nesta versão do Boot — busca em todos os jars do repositório local não encontrou nenhum candidato). Substituído por `spring.http.clients.connect-timeout`/`spring.http.clients.read-timeout` em `application.properties`, propriedade padrão que `spring-boot-starter-restclient` já aplica automaticamente a qualquer bean `RestClient.Builder` autoconfigurado (confirmado via `HttpClientsProperties`/`HttpClientAutoConfiguration` nos jars do Boot).
- `TMDB_API_TOKEN` adicionado ao bloco `<environmentVariables>` do Surefire (`pom.xml`), mesmo padrão do `JWT_SECRET` — necessário pro smoke test com Testcontainers (contexto Spring completo) não quebrar com a property sem fallback. Confirmado rodando a suíte completa após a mudança: sem regressão.

### Completion Notes List

- **Back-end**: proxy TMDb implementado em `br.com.rolo35.api.sessoes.catalogo` (`TmdbClient`, `FilmeDto`, `FilmeController`, `CatalogoIndisponivelException`) seguindo TDD RED→GREEN em cada subtask. 9 testes novos (6 unitários de `TmdbClient` com `MockRestServiceServer`, 3 de `@WebMvcTest` de `FilmeController`), todos verdes. `GlobalExceptionHandler` ganhou o handler de `CatalogoIndisponivelException` → `502 CATALOGO_INDISPONIVEL`. Autorização confirmada por inspeção (Task 2): nenhuma mudança em `SecurityConfig` necessária.
- **Refactor pós-implementação (Task 1)**: `TmdbClient` foi revisado depois do GREEN inicial — trocou construção manual do `RestClient` (dois construtores, timeout hard-coded) por um único construtor com `RestClient.Builder` injetado, adicionando a dependência `spring-boot-starter-restclient` e usando a propriedade padrão `spring.http.clients.*` pro timeout. Suíte completa (24 testes) re-executada após a mudança, sem regressão — inclusive o boot de contexto completo (`ApiApplicationTests`, smoke test com Testcontainers). Decisão registrada em `docs/decisions.md`.
- **Front-end**: `apiFetch` (`client.ts`) passou a anexar `Authorization: Bearer <token>` condicionalmente a partir do `localStorage` (2 testes novos em `client.test.ts`, RED→GREEN). `filmes.ts` criado (sem teste dedicado, por design — exercitado via `BuscaFilmesPage.test.tsx`). `BuscaFilmesPage.tsx` implementada com estados idle/loading/resultado(lista ou vazio)/error, reusando os design tokens da Story 1.1; rota `/organizador` trocada em `App.tsx`. Teste de contrato (`BuscaFilmesPage.test.tsx`, 4 casos) escrito depois do componente, por decisão já documentada no CLAUDE.md — todos verdes.
- **Confirmação final (Task 5)**: suíte completa verde — back-end 24/24 testes (`mvn test`, incluindo smoke test com Testcontainers e `ApiApplicationTests`, sem regressão), front-end 8/8 testes (`npm test`). `npm run build` (TypeScript estrito) e `npm run lint` (oxlint) também passam sem erro novo. Verificado manualmente que o bundle de produção não contém a chave TMDb (só a string `tmdbId`, nome de campo do DTO, o que é esperado e não é a AC 2 objetada).

### File List

**Back-end (novo)**
- `api/src/main/java/br/com/rolo35/api/sessoes/catalogo/FilmeDto.java`
- `api/src/main/java/br/com/rolo35/api/sessoes/catalogo/CatalogoIndisponivelException.java`
- `api/src/main/java/br/com/rolo35/api/sessoes/catalogo/TmdbClient.java`
- `api/src/main/java/br/com/rolo35/api/sessoes/catalogo/FilmeController.java`
- `api/src/test/java/br/com/rolo35/api/sessoes/catalogo/TmdbClientTest.java`
- `api/src/test/java/br/com/rolo35/api/sessoes/catalogo/FilmeControllerTest.java`

**Back-end (update)**
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java`
- `api/src/main/resources/application.properties`
- `api/pom.xml`
- `.env.example`
- `docker-compose.yml`

**Front-end (novo)**
- `web/src/api/filmes.ts`
- `web/src/api/client.test.ts`
- `web/src/pages/BuscaFilmesPage.tsx`
- `web/src/pages/BuscaFilmesPage.test.tsx`

**Front-end (update)**
- `web/src/api/client.ts`
- `web/src/App.tsx`

**Documentação (update)**
- `docs/decisions.md`
