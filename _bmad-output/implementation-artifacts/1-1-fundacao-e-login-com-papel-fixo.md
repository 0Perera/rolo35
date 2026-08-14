---
baseline_commit: 4fc6b7d9c8058f4710d127cfa7f1ae5eccc9d807
---

# Story 1.1: Fundação e Login com Papel Fixo

Status: in-progress

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a usuário do sistema (organizador, cliente ou portaria),
I want autenticar com minhas credenciais e receber um token que carregue meu papel,
so that eu acesse só as rotas permitidas pro meu papel, com o ambiente de dados já pronto.

## Acceptance Criteria

1. **Given** o repositório limpo **When** `docker compose up` é executado na raiz **Then** Postgres e a API sobem, o Flyway aplica `V1__schema.sql` (schema completo das 7 entidades: `usuarios`, `sessoes`, `salas`, `assentos`, `assento_sessao`, `reservas`, `ingressos`) automaticamente na subida, e um endpoint de health-check responde `200`.

2. **Given** o schema aplicado **When** `V2__seed.sql` roda **Then** existem exatamente os perfis seed: 1 organizador, 2 clientes, 1 portaria, e 1 sessão publicada com assentos livres — todos com senha conhecida documentada no README.

3. **Given** o front-end atual em Next.js **When** o re-scaffold pra Vite+React é aplicado **Then** `npm run dev` em `web/` sobe uma SPA funcional apontando pra API local, sem sobra de arquivo/config do Next.js anterior.

4. **Given** um usuário seed válido (ex.: cliente) e sua senha correta **When** ele faz `POST` no endpoint de login **Then** recebe `200` com um JWT assinado cujo claim inclui o `papel` da conta e uma expiração definida.

5. **Given** credenciais inválidas (senha errada ou e-mail inexistente) **When** o login é tentado **Then** a resposta é `401` com o mesmo envelope de erro genérico (`{codigo, mensagem}`) — não revela se o e-mail existe ou não.

6. **Given** um JWT válido de um papel qualquer **When** a resposta de qualquer endpoint autenticado é inspecionada **Then** nenhum campo sensível de banco (hash de senha, etc.) é retornado — resposta sempre via DTO explícito, nunca a entidade JPA direto.

7. **Given** a tela de login no front-end **When** o usuário envia o formulário com sucesso **Then** o token é guardado (`localStorage`) e o usuário é redirecionado conforme o papel; em erro, a tela mostra mensagem clara sem travar em estado de carregamento indefinido.

8. **Given** a tabela de usuários **When** a query de login busca por e-mail **Then** existe índice na coluna de lookup (NFR-8).

## Tasks / Subtasks

- [x] **Task 1 — Schema completo via Flyway (AC: 1, 8)**
  - [x] Criar `api/src/main/resources/db/migration/V1__schema.sql` com as 7 tabelas do ERD da Architecture Spine: `usuarios`, `salas`, `assentos`, `sessoes`, `assento_sessao`, `reservas`, `ingressos` — colunas, FKs, PKs e constraints conforme detalhado em Dev Notes
  - [x] `usuarios.email` com `UNIQUE` + índice explícito (AC 8, NFR-8)
  - [x] Adicionar `spring-boot-starter-actuator` ao `pom.xml`; expor só `/actuator/health` (`management.endpoints.web.exposure.include=health`)
  - [x] **Corrigir bug existente em `api/src/main/resources/application.properties`:** a chave `ddl-auto = validate` não é uma property real do Spring (falta o prefixo) — trocar por `spring.jpa.hibernate.ddl-auto=validate`. Sem essa correção, o Hibernate não está de fato configurado pra só validar o schema aplicado pelo Flyway.
  - [x] Validar: `docker compose up` sobe Postgres saudável, API aplica a migration no boot (`spring.jpa.hibernate.ddl-auto=validate`), `GET /actuator/health` responde `200`

- [x] **Task 2 — Seed versionado (AC: 2)**
  - [x] Criar `api/src/main/resources/db/migration/V2__seed.sql`: 1 `sala` com seus `assentos`, 1 `sessao` publicada vinculada a essa sala com dado de filme placeholder (tmdb_id/título/pôster fictícios — integração real TMDb é da Story 1.2), e uma linha `assento_sessao` (`status='LIVRE'`) pra **cada** assento da sala dessa sessão (AD-3 exige a linha populada na criação da sessão — seed não é exceção a essa regra)
  - [x] Inserir 1 organizador, 2 clientes, 1 portaria em `usuarios`, com `senha_hash` BCrypt pré-computado — gerar os hashes com `new BCryptPasswordEncoder().encode("senha-escolhida")` num teste/scratch descartável (não usar gerador BCrypt externo/online pra senha que vai documentada no repo), colar o hash resultante no `V2__seed.sql`
  - [x] Documentar no README as senhas em texto plano dos 4 perfis seed

- [x] **Task 3 — Domínio `auth` no back-end (AC: 4, 5, 6)**
  - [x] Pacote `br.com.rolo35.api.auth` com `controller/service/repository` próprios; entidade `Usuario`; `UsuarioRepository.findByEmail`
  - [x] Adicionar dependências JJWT ao `pom.xml`: `jjwt-api`, `jjwt-impl` (runtime), `jjwt-jackson` (runtime), versão `0.13.0`
  - [x] `JwtService`: gera token HS256 com claim `papel`, expiração definida (sugestão: 8h), assina com `security.jwt.secret` (env `JWT_SECRET`, sem fallback hardcoded em produção — só um default de conveniência pra dev local)
  - [x] Spring Security: sessão stateless, filtro de autenticação JWT, `PasswordEncoder` = `BCryptPasswordEncoder`; `POST /api/auth/login` público, todo o resto exige token por padrão
  - [x] Configurar CORS com allow-list explícita incluindo a origem do Vite dev (`http://localhost:5173`), sem `credentials` (AD-10) — sem isso o front não consegue nem chamar `/api/auth/login` em dev
  - [x] `LoginRequest`/`LoginResponse` como DTOs explícitos — nunca serializar `Usuario`/`senha_hash` (AC 6, AD-12); `LoginRequest` com Bean Validation (`@NotBlank` em email/senha), mesmo padrão que AD-7 já fixa pra DTOs de entrada
  - [x] `common/GlobalExceptionHandler` (`@RestControllerAdvice`) + `common/ApiError` — envelope `{codigo, mensagem}` (AD-11); credenciais inválidas mapeiam pra `401` com mensagem genérica idêntica pra "senha errada" e "e-mail inexistente" (AC 5); fallback genérico pra exceção não mapeada (`500`, `ERRO_INTERNO`)

- [x] **Task 4 — Re-scaffold do front-end pra Vite+React (AC: 3)**
  - [x] Remover artefatos Next.js: `web/src/app/`, `web/next.config.ts`, `web/next-env.d.ts`, `web/.next/`, `web/node_modules/`, `web/package-lock.json`, `web/AGENTS.md` e `web/CLAUDE.md` (gerados automaticamente pelo `next dev` — não são arquivo de projeto)
  - [x] Scaffold Vite + React 19.2.8 + TypeScript 6.x (`strict: true`) + Tailwind CSS 4.x via plugin `@tailwindcss/vite` (CSS-first, sem `tailwind.config.js`)
  - [x] Adicionar `react-router` (pacote único, v8.x — substituiu `react-router-dom` a partir da v7/v8) pras rotas da SPA
  - [x] `web/src/api/client.ts`: wrapper de `fetch` com timeout com folga (~90s) pro cold start documentado do Render (AD-2); `web/src/api/auth.ts`: função tipada de login
  - [x] **Design tokens do tema cinema 35mm** — definir agora, no CSS-first `@theme` do Tailwind (`web/src/index.css`), pra toda tela futura herdar sem retrabalho de retrofit. Só tokens (cor/tipografia), nenhum componente construído em cima ainda — ver paleta e fontes exatas em Dev Notes

- [x] **Task 5 — Tela de login (AC: 7)**
  - [x] Formulário de login com estados de carregando/erro/sucesso
  - [x] Sucesso: guarda o token em `localStorage`, decodifica o claim `papel`, redireciona pra uma rota placeholder por papel (`/organizador`, `/cliente`, `/portaria`) — as telas reais de cada papel são construídas em épicos futuros, este placeholder só prova o redirecionamento correto
  - [x] Erro: mensagem clara na própria tela, sem travar em estado de carregamento indefinido

- [x] **Task 6 — Testes (nascem antes do código, por camada)**
  - [x] Unitário (JUnit/Mockito, sem contexto Spring): `JwtService` — gera token com claim `papel` correto e `exp` futuro; token adulterado/expirado falha na validação
  - [x] `@WebMvcTest` com `AuthService` mockado: `POST /api/auth/login` → `200` + token pra credencial válida; `401` + envelope `{codigo, mensagem}` genérico pra credencial inválida (AC 5); resposta nunca inclui `senha_hash` (AC 6)
  - [x] Smoke test de repository com Testcontainers (`.withReuse(true)`): contexto Spring sobe com Postgres real, Flyway aplica `V1__schema.sql` + `V2__seed.sql` sem erro, `UsuarioRepository.findByEmail` encontra os 4 perfis seed
  - [x] **Corrigir `api/src/test/java/br/com/rolo35/api/TestcontainersConfiguration.java` existente:** hoje usa `DockerImageName.parse("postgres:latest")` sem `.withReuse(true)` — trocar pra `postgres:16-alpine` (mesma versão pinada no `docker-compose.yml` e na Architecture Spine) e adicionar `.withReuse(true)` (prática XP explícita do projeto, evita subir Postgres do zero a cada rodada de teste)
  - [x] Front: teste leve de contrato do formulário de login (submit chama `api/auth.ts`, trata sucesso e erro), escrito depois do componente pronto — não é teste de renderização

### Review Findings

- [x] [Review][Patch] CORS com allow-list fixa em `localhost:5173` — tornar `allowedOrigins` configurável via env var (`CORS_ALLOWED_ORIGINS`, default `http://localhost:5173`), decidido em code review em vez de deixar fixo até uma story de deploy [api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java:39-46] — **resolvido**: `@Value("${cors.allowed-origins}")` lido de `CORS_ALLOWED_ORIGINS`, documentado em `.env.example`/`docker-compose.yml`
- [x] [Review][Patch] JWT secret tem fallback commitado, sem fail-fast em produção, e não está documentado no `.env.example`/`docker-compose.yml` [api/src/main/resources/application.properties:15] — **resolvido**: `security.jwt.secret=${JWT_SECRET}` sem default (falha no boot se ausente, validado via `docker compose run` com `JWT_SECRET` vazio → `WeakKeyException`), documentado em `.env.example`/`docker-compose.yml`, secret real gerado localmente
- [ ] [Review][Patch] Submissão de login com campo vazio retorna `500` genérico em vez de `400`/mensagem de validação — front desabilita a validação nativa (`noValidate` + `required` contraditórios) e o back não mapeia `MethodArgumentNotValidException` [api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java:19; web/src/pages/LoginPage.tsx:47]
- [ ] [Review][Patch] Handler genérico de exceção (`500`) não loga nada — qualquer erro inesperado fica invisível em produção (Render free só tem log de request) [api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java:19]
- [x] [Review][Patch] `AuthService` sem teste unitário dedicado — a garantia da AC5 (senha errada e e-mail inexistente convergem pra mesma exceção) nunca é testada contra o serviço real, só contra o mock no `@WebMvcTest` [api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java] — **resolvido**: `AuthServiceTest` (Mockito puro), efeito colateral de testar o fix do timing side-channel abaixo
- [ ] [Review][Patch] `common` depende de volta pra `auth` (`GlobalExceptionHandler` importa `CredenciaisInvalidasException` diretamente) — inverte a direção de dependência pretendida; cada domínio futuro (sessões, reservas, pagamentos, ingressos) vai forçar `common` a importar dele também [api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java:3]
- [ ] [Review][Patch] Sem `AuthenticationEntryPoint`/`AccessDeniedHandler` — rejeição de rota protegida sem token usa o `403`/`401` padrão do Spring Security, não o envelope `{codigo, mensagem}` do resto da API; e nenhum teste cobre esse caminho [api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java:31]
- [x] [Review][Patch] Timing side-channel no login: e-mail inexistente responde mais rápido que senha errada (só o segundo roda BCrypt), vazando a existência do e-mail por tempo de resposta apesar do corpo/status idênticos (fere o espírito da AC5) [api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java:27-30] — **resolvido**: `AuthService.login` sempre roda `passwordEncoder.matches` (contra um hash dummy quando o e-mail não existe), coberto por `AuthServiceTest.runsPasswordComparisonEvenWhenEmailDoesNotExist`
- [ ] [Review][Patch] Verificação do esquema `Bearer` é case-sensitive (`startsWith("Bearer ")`), rejeitando clientes que mandem `bearer`/`BEARER` [api/src/main/java/br/com/rolo35/api/auth/JwtAuthenticationFilter.java:30]
- [x] [Review][Patch] Claim `papel` ausente autentica como `ROLE_null` em vez de falhar fechado [api/src/main/java/br/com/rolo35/api/auth/JwtAuthenticationFilter.java:33-35] — **resolvido**: filtro só autentica quando `papel != null`, coberto por `JwtAuthenticationFilterTest.doesNotAuthenticateWhenPapelClaimIsMissing`
- [ ] [Review][Patch] Lookup e unicidade de e-mail são case-sensitive — usuário que digita e-mail com caixa diferente da cadastrada recebe "credenciais inválidas" mesmo com senha certa [api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java:27; api/src/main/resources/db/migration/V1__schema.sql]
- [ ] [Review][Patch] Colunas de timestamp sem timezone (`TIMESTAMP`) enquanto o JPA mapeia `Instant` — `sessoes.data_hora` (horário de sessão de cinema) é exatamente o campo onde isso vira horário errado se o timezone do servidor divergir do dev [api/src/main/resources/db/migration/V1__schema.sql:37]
- [ ] [Review][Patch] Timeout/cold-start do Render sem mensagem específica — `AbortError` cai na mensagem genérica de erro, perdendo a chance de avisar "servidor iniciando, tente de novo" (o motivo documentado do timeout de 90s existir, AD-2) [web/src/api/client.ts:18]
- [ ] [Review][Patch] Parse do JSON de sucesso sem tratamento de erro — corpo `200` vazio/malformado gera `SyntaxError` não capturado como `ApiRequestError`, perdendo o status/diagnóstico real [web/src/api/client.ts:39]
- [ ] [Review][Patch] Falha ao gravar no `localStorage` após login bem-sucedido é reportada como falha de login — navegador restritivo (ex.: modo privado do Safari) faz o usuário já autenticado ver "não foi possível entrar" [web/src/pages/LoginPage.tsx:33-36]
- [ ] [Review][Patch] `rotaPorPapel` co-exportado no mesmo arquivo do componente `LoginPage` quebra o Fast Refresh (aviso do `oxlint`, `only-export-components`) [web/src/pages/LoginPage.tsx:8]

- [x] [Review][Defer] Sem comportamento `ON DELETE` declarado nas FKs [api/src/main/resources/db/migration/V1__schema.sql] — deferred, pre-existing (nenhuma feature de exclusão existe ainda; default `NO ACTION` do Postgres é seguro por ora)
- [x] [Review][Defer] `papel` é `String` solta no back (sem enum) e o front confia num cast não validado (`as T` em `client.ts:39`) sem `default` no switch de `rotaPorPapel` [api/src/main/java/br/com/rolo35/api/auth/Usuario.java; web/src/pages/LoginPage.tsx:8] — deferred, pre-existing (endurecimento de type-safety maior que o escopo desta story; nada quebra hoje porque front e back nascem da mesma fonte de verdade)

## Dev Notes

- **Schema (V1__schema.sql) — DDL guiado pelo ERD da Architecture Spine (AD-1, AD-13):**
  - `usuarios(id BIGSERIAL PK, nome, email UNIQUE + índice, senha_hash, papel, created_at)` — `papel` como `VARCHAR` + `CHECK (papel IN ('ORGANIZADOR','CLIENTE','PORTARIA'))`, não enum nativo do Postgres (evita complexidade de `ALTER TYPE` em migrations futuras) — mesmo padrão vale pros demais campos de estado abaixo.
  - `salas(id BIGSERIAL PK, nome, linhas, colunas)`.
  - `assentos(id BIGSERIAL PK, sala_id FK → salas, fileira, numero)`.
  - `sessoes(id BIGSERIAL PK, organizador_id FK → usuarios, sala_id FK → salas, tmdb_id, titulo, poster_url, sinopse, data_estreia, data_hora, preco, created_at)` — snapshot dos campos TMDb (AD-14), sem tabela `filmes`.
  - `assento_sessao(sessao_id FK → sessoes, assento_id FK → assentos, status, reserva_id FK → reservas NULLABLE, expires_at NULLABLE, PK composta (sessao_id, assento_id))` — `status CHECK IN ('LIVRE','RESERVADO','VENDIDO')`. `UNIQUE (sessao_id, assento_id)` já é a própria PK composta, serve de backstop estrutural (AD-3).
  - `reservas(id BIGSERIAL PK, cliente_id FK → usuarios, sessao_id FK → sessoes, status, created_at, expires_at)` — `status CHECK IN ('ATIVA','CONFIRMADA','RECUSADA')`.
  - `ingressos(id UUID PK — não BIGSERIAL —, reserva_id FK → reservas, assento_id FK → assentos, sessao_id FK → sessoes, status, validated_at, created_at)` — `status CHECK IN ('VALIDO','UTILIZADO')`. **Crítico:** `id` tem que ser `UUID` gerado na aplicação/banco, nunca sequencial — é a própria PK usada no código HMAC do ingresso (AD-8, Epic 4); usar `BIGSERIAL` aqui quebra o non-negotiable de código de ingresso não-forjável por incremento.
  - Índices recomendados já nesta migration, já que o schema é criado de uma vez só (evita `ALTER` em épico futuro): `sessoes(data_hora)` e `sessoes(sala_id)` — usados pela listagem pública (Epic 2/FR-8) e pela checagem de conflito de horário (Epic 2/FR-6). Não é AC desta story, mas é o momento certo de criar.
  - Motivo do schema completo de uma vez nesta story (não incremental por épico): decisão explícita da Architecture Spine (AD-3) — FKs cruzadas entre domínios futuros (`assento_sessao` → `reservas` → `pagamentos`/`ingressos`) e os testes de concorrência via Testcontainers de épicos futuros (FR-6, FR-11, FR-20) precisam do schema completo de pé desde já. Já validado como exceção consciente no Implementation Readiness Report — não reabrir essa discussão.

- **Seed (V2__seed.sql):** a sessão seed **precisa** ter linhas `assento_sessao` populadas pra cada assento da sala (mesma regra do AD-3 que vale pra qualquer criação de sessão em produção) — não basta inserir a linha em `sessoes`. Senha em texto plano dos 4 perfis vai documentada no README (seção de dados de teste), hash BCrypt na coluna.

- **Auth/JWT:** biblioteca JJWT (`io.jsonwebtoken`) `0.13.0` — versão mais recente verificada em 2026-08-10, artefatos separados `jjwt-api`/`jjwt-impl`/`jjwt-jackson` (o artefato legado único `jjwt` está descontinuado). Secret via `JWT_SECRET` (env var, non-negotiable de segredo — nunca commitado). Claim `papel` no token — é o que toda rota autenticada valida no back-end (non-negotiable: nunca confiar em esconder rota/botão no front).

- **CORS (AD-10):** allow-list explícita de origem, sem `credentials`. Em dev local o front (Vite, porta `5173` por padrão) e a API (porta `8080`) já são origens diferentes — sem CORS configurado nesta story, a tela de login nem chega a testar o back-end de verdade.

- **Envelope de erro (AD-11):** `GlobalExceptionHandler` criado agora vale pro projeto inteiro daqui pra frente — próximas stories só adicionam código de erro novo ao enum, não recriam o handler.

- **Front — re-scaffold:** Tailwind 4.x com o plugin `@tailwindcss/vite` é o caminho idiomático pra Vite (config via `@import "tailwindcss"` no CSS, sem `tailwind.config.js` nem PostCSS manual). `react-router` como pacote único (não `react-router-dom` — descontinuado a partir da v7/v8, mantido só como re-export de migração). Identidade visual (tema cinema 35mm) é non-negotiable do projeto mas não é AC desta story — a tela de login pode ficar funcional e simples; telas subsequentes é que aplicam o tema por completo.
  - **`client.ts` (AD-2):** timeout de `fetch` com folga (~90s, não o default do browser) — cold start do Render (~1min) não pode ser confundido com erro de rede depois do deploy; em dev local não tem efeito prático, mas o mecanismo precisa existir desde já pra não virar retrabalho.
  - Placeholders de destino pós-login (`/organizador`, `/cliente`, `/portaria`): telas reais de cada papel não existem ainda (vêm em épicos futuros) — o placeholder só precisa provar que o redirecionamento por papel funciona, não implementar a feature do papel.

- **Design tokens (tema cinema 35mm) — definidos agora pra evitar retrofit em tela já construída:** só tokens de cor e tipografia via `@theme` do Tailwind 4 (`web/src/index.css`), nenhum componente (moldura de perfuração, transição de contagem regressiva) construído nesta story — isso fica pra quando a tela que realmente precisa dele for implementada, senão é trabalho antecipado sem uso ainda.
  ```css
  @import "tailwindcss";

  @theme {
    /* base sépia/âmbar — fundo e superfícies */
    --color-sepia-950: #14100d;
    --color-sepia-900: #1f1810;
    --color-sepia-800: #2c2016;
    --color-sepia-700: #3b2a1a;

    /* âmbar — destaque secundário */
    --color-amber-400: #d99a44;
    --color-amber-300: #e6b567;

    /* vermelho veludo — ação primária/CTA */
    --color-velvet-700: #7a1220;
    --color-velvet-600: #8c1c2c;

    /* dourado — borda, foco, acento de moldura */
    --color-gold-500: #c9a227;

    /* texto sobre fundo escuro */
    --color-cream-100: #f2e8d5;
    --color-cream-300: #b8a692;

    /* tipografia: marquise robusta pra título, serifada legível pro corpo — evita sans-serif genérica de SaaS */
    --font-display: "Bebas Neue", sans-serif;
    --font-body: "Lora", serif;
  }
  ```
  - `--color-*` e `--font-*` no `@theme` geram utilities automaticamente (`bg-sepia-950`, `text-velvet-600`, `border-gold-500`, `font-display`, etc.) — comportamento nativo do Tailwind v4, sem `tailwind.config.js`.
  - Fontes via `@fontsource/bebas-neue` e `@fontsource/lora` (pacotes npm, self-hosted) em vez de link pro Google Fonts CDN — evita round-trip de rede externa no boot da SPA e mantém o build autocontido; importar uma vez em `main.tsx`.
  - Tela de login desta story já pode usar os tokens (`bg-sepia-950`, `font-display` no título, `bg-velvet-600` no botão) — é diferença de custo zero em relação a hardcodar cor solta, e é exatamente o que evita o retrabalho perguntado.

### Project Structure Notes

- Segue a estrutura já fixada na Architecture Spine (§ Structural Seed) — sem variância detectada.
- Back-end: `api/src/main/java/br/com/rolo35/api/auth/{controller,service,repository}` + `Usuario.java`; `api/src/main/java/br/com/rolo35/api/common/{GlobalExceptionHandler.java,ApiError.java}`.
- Front-end: `web/src/api/{client.ts,auth.ts}`, `web/src/pages/` (ou `routes/`) com a tela de login e os 3 placeholders por papel.
- Pacote raiz do back-end já existe como `br.com.rolo35.api` (não `br.com.rolo35` puro, conforme `ApiApplication.java` atual) — novos pacotes de domínio (`auth`, e futuramente `sessoes`, `reservas`, `pagamentos`, `ingressos`) entram dentro de `br.com.rolo35.api.*`, mantendo o pacote raiz existente.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Fundação e Login com Papel Fixo]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3, AD-10, AD-11, AD-12, AD-13, AD-14, Structural Seed, Entidades (ERD)]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-08-10.md — Major Issue "Criação de schema completo na Story 1.1" (exceção aceita, AD-3)]
- [Source: instruções do projeto — segredos só em variável de ambiente com `.env.example` versionado, seed de dados de teste versionado, autorização validada no back-end, identificador de ingresso não sequencial]
- [Source: docs/decisions.md — "JWT para autenticação", "Vite + React puro em vez de Next.js", "Empacotamento por domínio, não por camada técnica", "Autenticação SPA↔API: Bearer JWT em localStorage, sem cookie"]
- Pesquisa web (2026-08-10): JJWT `0.13.0` (io.jsonwebtoken, ago/2025, artefatos `jjwt-api`/`jjwt-impl`/`jjwt-jackson`); `react-router` v8.x (pacote único, `react-router-dom` descontinuado).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code — persona Amelia (bmad-dev-story)

### Debug Log References

- `docker compose up` (validação Task 1): Postgres saudável, Flyway aplica `V1__schema.sql`, `GET /actuator/health` → `200`.
- `docker compose down -v && docker compose up --build` (validação Task 2): Flyway aplica `V1` + `V2` sem erro (`Successfully applied 2 migrations`).
- `./mvnw test` (back-end completo): 9 testes, 0 falhas — `JwtServiceTest` (3), `AuthControllerTest` (3), `UsuarioRepositorySmokeTest` (1, Testcontainers), `ApiApplicationTests` (1), scratch de geração de hash já removido do código-fonte antes do commit.
- `curl -X POST /api/auth/login`: credencial válida → `200` + JWT com claim `papel`; senha errada e e-mail inexistente → `401` com envelope `{codigo:"CREDENCIAIS_INVALIDAS", mensagem:"..."}` idêntico nos dois casos; resposta nunca inclui `senhaHash`.
- `curl -X OPTIONS /api/auth/login -H "Origin: http://localhost:5173"`: preflight CORS responde `200` com `Access-Control-Allow-Origin: http://localhost:5173` e sem `Access-Control-Allow-Credentials`.
- `npx tsc -b`, `npm run build`, `npm test` (front): typecheck estrito, build de produção e os 2 testes de contrato do `LoginPage` passam.
- Sem acesso a browser interativo nesta sessão (ferramenta indisponível) — fluxo de login foi validado via testes de contrato (Vitest + Testing Library) e via chamadas HTTP diretas à API, não visualmente num navegador real.
- **Pós code review** — `docker compose run --rm -e JWT_SECRET= api`: confirma fail-fast (`WeakKeyException`, app não sobe sem `JWT_SECRET`). `docker compose down -v && docker compose up --build` com `.env` real (JWT_SECRET gerado via `openssl rand -base64 48`): sobe normalmente, `/actuator/health` → `200`. `curl` login válido/inválido + preflight CORS repetidos após os fixes: mesmo comportamento de antes, sem regressão. `./mvnw test`: 14 testes, 0 falhas (6 novos desde a última rodada: `JwtAuthenticationFilterTest` com 2 casos, `AuthServiceTest` com 4 casos — ver File List).

### Completion Notes List

- Corrigido bug pré-existente em `application.properties` (`ddl-auto` sem prefixo `spring.jpa.hibernate.`).
- Corrigido `TestcontainersConfiguration` pré-existente (`postgres:latest` → `postgres:16-alpine` + `.withReuse(true)`); precisou virar `public` pra ser reaproveitado fora do pacote `br.com.rolo35.api`.
- Spring Boot 4.1 / Spring Security 7.1 / Spring Framework 7 trouxeram mudanças de pacote não documentadas nos Dev Notes originais, resolvidas durante a implementação: `@WebMvcTest`/`@AutoConfigureMockMvc` migraram pra `org.springframework.boot.webmvc.test.autoconfigure`; `@MockBean` foi substituído por `@MockitoBean` (`org.springframework.test.context.bean.override.mockito`); `UsernamePasswordAuthenticationFilter` vive em `org.springframework.security.web.authentication`; o `ObjectMapper` autoconfigurado pelo Spring MVC é `tools.jackson.databind.ObjectMapper` (Jackson 3), não mais `com.fasterxml.jackson.databind` (esse continua existindo só como dependência transitiva do `jjwt-jackson`).
- Hashes BCrypt do seed gerados com `BCryptPasswordEncoder` num teste-scratch (`ScratchBCryptHashGeneratorTest`), executado e removido do código-fonte antes de qualquer commit — só o hash resultante ficou em `V2__seed.sql`.
- `LoginPage` usa o campo `papel` já retornado no corpo do `LoginResponse` pra decidir a rota de redirecionamento, em vez de decodificar o JWT no client — mais simples e evita adicionar uma lib de decode só pra isso nesta story.
- Front re-scaffoldado via `npm create vite@latest -- --template react-ts` (React 19.2.8, TypeScript ~6.0.2 com `strict: true`, Vite 8); Tailwind 4 configurado via `@tailwindcss/vite` sem `tailwind.config.js`; `react-router` v8 (pacote único).
- `NODE_OPTIONS=--no-experimental-webstorage` adicionado ao script `test` do front — Node 26 expõe um `localStorage` experimental global que conflita com o do ambiente `jsdom` do Vitest; sem a flag, `localStorage.clear()` falhava nos testes.

**Pós code review (2026-08-10)** — revisão adversarial com 3 camadas paralelas (Blind Hunter, Edge Case Hunter, Acceptance Auditor) achou 23 findings reais (após deduplicação) + 5 falsos positivos descartados. 1 decision-needed (CORS) resolvido com o usuário. 5 dos 15 patches aplicados nesta sessão (críticos, escolhidos pelo usuário — os outros 10 ficaram como action items na story pra tratar depois):
- JWT secret agora exige `JWT_SECRET` sem fallback (`security.jwt.secret=${JWT_SECRET}`, sem default) — falha no boot se ausente; secret de dev real gerado com `openssl rand -base64 48`, documentado em `.env.example`/`docker-compose.yml`.
- CORS `allowedOrigins` virou `@Value("${cors.allowed-origins}")`, lido de `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`).
- `AuthService.login` sempre roda `passwordEncoder.matches` (contra hash dummy quando o e-mail não existe) — fecha o timing side-channel que deixava e-mail inexistente responder mais rápido que senha errada, o que vazava existência de e-mail por tempo de resposta (feria o espírito da AC5).
- `JwtAuthenticationFilter` só autentica quando o claim `papel` não é nulo — antes, um token sem esse claim autenticava com `ROLE_null` em vez de falhar fechado.
- `AuthServiceTest` criado como efeito colateral de testar o fix do timing side-channel — também fecha a lacuna "sem teste unitário dedicado" apontada separadamente na revisão.
- `maven-surefire-plugin` ganhou `JWT_SECRET` de teste via `environmentVariables` (pom.xml) — necessário porque o `application.properties` principal não tem mais fallback e `@SpringBootTest`s sobem o contexto completo.
- Detalhe dos 15 patches (5 resolvidos + 10 pendentes) e dos 2 itens deferred está na seção **Review Findings**, acima; os 10 pendentes continuam desmarcados como `- [ ] [Review][Patch]` pra virar trabalho futuro.

### File List

**Back-end (novo):**
- `api/src/main/resources/db/migration/V1__schema.sql`
- `api/src/main/resources/db/migration/V2__seed.sql`
- `api/src/main/java/br/com/rolo35/api/auth/Usuario.java`
- `api/src/main/java/br/com/rolo35/api/auth/JwtService.java`
- `api/src/main/java/br/com/rolo35/api/auth/JwtAuthenticationFilter.java`
- `api/src/main/java/br/com/rolo35/api/auth/CredenciaisInvalidasException.java`
- `api/src/main/java/br/com/rolo35/api/auth/repository/UsuarioRepository.java`
- `api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java`
- `api/src/main/java/br/com/rolo35/api/auth/controller/AuthController.java`
- `api/src/main/java/br/com/rolo35/api/auth/dto/LoginRequest.java`
- `api/src/main/java/br/com/rolo35/api/auth/dto/LoginResponse.java`
- `api/src/main/java/br/com/rolo35/api/common/ApiError.java`
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java`
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java`
- `api/src/test/java/br/com/rolo35/api/auth/JwtServiceTest.java`
- `api/src/test/java/br/com/rolo35/api/auth/AuthControllerTest.java`
- `api/src/test/java/br/com/rolo35/api/auth/UsuarioRepositorySmokeTest.java`
- `api/src/test/java/br/com/rolo35/api/auth/JwtAuthenticationFilterTest.java` (code review — claim `papel` ausente)
- `api/src/test/java/br/com/rolo35/api/auth/service/AuthServiceTest.java` (code review — timing side-channel + cobertura da AC5)

**Back-end (modificado):**
- `api/pom.xml` (actuator, JJWT 0.13.0; code review — `maven-surefire-plugin` com `JWT_SECRET` de teste)
- `api/src/main/resources/application.properties` (fix `ddl-auto`, actuator, JWT secret/expiração; code review — `JWT_SECRET` sem fallback, `CORS_ALLOWED_ORIGINS`)
- `api/src/test/java/br/com/rolo35/api/TestcontainersConfiguration.java` (`postgres:16-alpine` + `.withReuse(true)` + `public`)
- `api/src/main/java/br/com/rolo35/api/auth/JwtAuthenticationFilter.java` (code review — não autentica sem claim `papel`)
- `api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java` (code review — comparação de senha sempre roda, mesmo pra e-mail inexistente)
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (code review — CORS via `@Value`)

**Front-end (removido — re-scaffold Next.js → Vite):**
- `web/src/app/**`, `web/next.config.ts`, `web/next-env.d.ts`, `web/.next/`, `web/node_modules/`, `web/package-lock.json`, `web/AGENTS.md`, `web/CLAUDE.md`, `web/postcss.config.mjs`, `web/eslint.config.mjs`, `web/public/{file,globe,next,vercel,window}.svg`

**Front-end (novo — scaffold Vite):**
- `web/index.html`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/.oxlintrc.json`, `web/.gitignore`, `web/.env.example`, `web/public/favicon.svg`
- `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`
- `web/src/api/client.ts`, `web/src/api/auth.ts`
- `web/src/pages/LoginPage.tsx`, `web/src/pages/LoginPage.test.tsx`, `web/src/pages/PapelPlaceholderPage.tsx`
- `web/src/test/setup.ts`

**Front-end (modificado):**
- `web/package.json` (dependências: react-router, tailwindcss, @tailwindcss/vite, @fontsource/*, vitest, testing-library, jsdom)
- `web/tsconfig.app.json` (`strict: true` explícito)

**Outros:**
- `.gitignore` (adiciona `dist/` na seção Node)
- `README.md` (comandos de setup, dados de teste, limitação Render)
- `_bmad-output/implementation-artifacts/1-1-fundacao-e-login-com-papel-fixo.md` (frontmatter `baseline_commit`, tasks marcadas, Review Findings, Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status da story)
- `_bmad-output/implementation-artifacts/deferred-work.md` (novo — 2 itens deferred da code review)
- `.env.example` (code review — `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`)
- `.env` (não versionado — code review — `JWT_SECRET` real gerado, `CORS_ALLOWED_ORIGINS`)
- `docker-compose.yml` (code review — `JWT_SECRET`/`CORS_ALLOWED_ORIGINS` repassados pro serviço `api`)
