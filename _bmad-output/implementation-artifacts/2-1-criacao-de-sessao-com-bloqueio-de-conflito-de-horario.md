---
baseline_commit: 56d31d0
---

# Story 2.1: Criação de Sessão com Bloqueio de Conflito de Horário

Status: ready-for-dev

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a organizador,
I want criar uma sessão vinculando um filme do catálogo, uma sala existente, data/hora futura e preço,
so that eu abro venda de ingressos pra um horário sem risco de colidir com outra sessão na mesma sala.

## Acceptance Criteria

1. **Given** um organizador autenticado, um filme buscado via catálogo TMDb, uma sala já cadastrada e uma data/hora futura **When** ele submete a criação da sessão com um preço **Then** a sessão é criada com capacidade derivada do mapa de assentos da sala (não um número digitado livremente) e vinculada ao organizador como dono do recurso.

2. **Given** uma data/hora no passado **When** a criação é submetida **Then** é rejeitada com erro claro, sessão não é criada.

3. **Given** uma sala que já tem outra sessão cujo horário se sobrepõe (considerando o buffer fixo de 4h entre sessões na mesma sala, AD-3) **When** uma nova sessão conflitante é submetida **Then** é rejeitada — duas sessões não coexistem na mesma sala com sobreposição real de horário.

4. **Given** duas requisições concorrentes de criação de sessão pra mesma sala com horário sobreposto (cenário Testcontainers) **When** ambas são disparadas ao mesmo tempo **Then** exatamente uma é aceita, garantido por constraint/lock de banco — não checagem isolada na aplicação.

5. **Given** um usuário autenticado como `CLIENTE` ou `PORTARIA` **When** tenta criar uma sessão **Then** a requisição é rejeitada com `403`.

## Branch e commits — regra obrigatória desta story

Antes de começar a Task 1, criar e mudar pra uma branch nova dedicada ao épico: `epic-2-gestao-de-sessoes-organizador`, a partir de `main` (mesmo padrão já usado pela branch `epic-1-autenticacao-e-catalogo-de-filmes`, que existe local e remota).

Cada task abaixo termina em **um commit próprio**, só com o que foi feito naquela task, nessa branch. Ciclo por task: **RED** (escrever o teste, rodar, confirmar que falha por ausência do código) → **GREEN** (código mínimo que faz passar, rodar até verde) → **commit**. Mensagem de commit: curta e direta, no padrão Conventional Commits já usado no repo — `tipo(sessoes): descrição curta` (ver `git log` pra exemplos reais: `feat(auth): ...`, `test: ...`, `fix(catalogo): ...`, `docs(catalogo): ...`). Cada task abaixo já sugere a mensagem — use como base, ajuste se o que foi implementado de fato divergir um pouco. Tasks sem teste próprio (migration, docs) commitam do mesmo jeito, sem par RED/GREEN — só o commit ao final da task.

## TDD — regra obrigatória desta story

> Regra única do projeto (CLAUDE.md § Metodologia XP + TDD): **todo teste nasce antes do código**, sempre. Cada subtask de código abaixo é precedida da sua subtask de teste, marcada **[RED]**. Ciclo: escrever o teste → rodar e ver falhar por ausência do código (RED) → escrever o código mínimo que faz passar (**[GREEN]**) → refactor se necessário, mantendo os testes verdes. Não pule o RED. A única exceção documentada no projeto é a UI de interação visual (Tasks 8 e 9 abaixo), cujo teste de contrato nasce **depois** do componente pronto (cobertura leve, focada em contrato de comportamento, não em renderização) — todo o resto segue RED→GREEN sem exceção.

## Tasks / Subtasks

- [x] **Task 1 — Índice composto pra checagem de conflito (sem teste, é infraestrutura)**
  - [x] Criar `api/src/main/resources/db/migration/V3__indice_sessoes_sala_data_hora.sql`: `CREATE INDEX idx_sessoes_sala_id_data_hora ON sessoes (sala_id, data_hora);`. Motivo: a query de conflito de horário (AD-3) filtra por igualdade em `sala_id` e faz range em `data_hora` — os dois índices simples já existentes (`idx_sessoes_sala_id`, `idx_sessoes_data_hora`) só suportam bitmap-AND, pior que um composto no caminho crítico que roda com a linha da `sala` travada (AD-5 quer a transação de lock a mais curta possível). Manter os dois índices simples (a Story 2.3 de listagem pública provavelmente quer `data_hora` sozinho).
  - [x] Commit: `feat(sessoes): índice composto sala_id+data_hora pra checagem de conflito (V3)`

- [x] **Task 2 — Entidades e repositories de Sala, Assento, Sessão e AssentoSessao**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/SalaAssentoRepositorySmokeTest.java` (mesmo padrão de `UsuarioRepositorySmokeTest`: `@Import(TestcontainersConfiguration.class) @SpringBootTest`) cobrindo: `SalaRepository.findAll()` retorna a sala seed "Sala 1" (`linhas=5, colunas=8`); `AssentoRepository.findBySalaId(salaId)` retorna 40 assentos. Rodar e confirmar que falha por `Sala`/`Assento`/os repositories ainda não existirem.
  - [x] **[GREEN]** Criar as entidades em `br.com.rolo35.api.sessoes` (raiz do pacote, mesmo nível de `Usuario.java` em `auth`): `Sala` (`id, nome, linhas, colunas`), `Assento` (`id, salaId, fileira, numero` — campo FK simples `Long`, sem `@ManyToOne`, mesmo estilo de `Usuario`), `Sessao` (`id, organizadorId, salaId, tmdbId, titulo, posterUrl, sinopse, dataEstreia, dataHora, preco, createdAt` — **sem** campo `capacidade`, ela é sempre derivada de `sala.linhas * sala.colunas`, nunca persistida, porque o schema não tem essa coluna e a AC1 exige que não seja "um número digitado livremente"), `AssentoSessaoId` (`@Embeddable`, `sessaoId + assentoId`) e `AssentoSessao` (`@EmbeddedId AssentoSessaoId id`, `status, reservaId, expiresAt`). Todas com `@Getter @NoArgsConstructor` (Lombok, padrão já usado); `Sessao` ganha também `@Builder` (é a primeira entidade do projeto de fato construída por código de aplicação em vez de só lida de seed/SQL — não existe outro precedente de construtor mutável pra copiar, então builder é a escolha mais limpa aqui).
  - [x] Criar `repository/SalaRepository.java` com `findByIdForUpdate`: `@Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from Sala s where s.id = :id") Optional<Sala> findByIdForUpdate(@Param("id") Long id)` — é o `SELECT ... FOR UPDATE` na linha da sala que serializa criações concorrentes pra ela (AD-3).
  - [x] Criar `repository/AssentoRepository.java` com `findBySalaId(Long salaId)`.
  - [x] Criar `repository/SessaoRepository.java` com uma query nativa `existeConflitante(salaId, dataHora, bufferMinutos)` usando aritmética de `INTERVAL` do Postgres (JPQL não expressa isso de forma portável):
    ```java
    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM sessoes
          WHERE sala_id = :salaId
            AND data_hora < (CAST(:dataHora AS timestamp) + (INTERVAL '1 minute' * :bufferMinutos))
            AND (data_hora + (INTERVAL '1 minute' * :bufferMinutos)) > CAST(:dataHora AS timestamp)
        )""", nativeQuery = true)
    boolean existeConflitante(@Param("salaId") Long salaId, @Param("dataHora") LocalDateTime dataHora, @Param("bufferMinutos") int bufferMinutos);
    ```
    `bufferMinutos` (240 = 4h) é passado pelo `SessaoService` a partir de UMA constante só no código — não hardcoded na query.
  - [x] Criar `repository/AssentoSessaoRepository.java`, `JpaRepository<AssentoSessao, AssentoSessaoId>` — `saveAll(...)` cobre o insert em lote (só 40 linhas pra "Sala 1", sem necessidade de insert nativo em batch nessa escala).
  - [x] Rodar o smoke test até passar.
  - [x] Commit: `feat(sessoes): entidades e repositories de Sala, Assento, Sessão e AssentoSessao`

  **Deviation documentada (registrar em `docs/decisions.md` na Task 10, decidir aqui)**: `AssentoSessao`/`AssentoSessaoRepository` ficam no pacote `sessoes`, não em `reservas` como o Structural Seed da Architecture Spine sugere literalmente. Motivo: AD-3 exige popular `assento_sessao` na mesma transação do insert de `sessoes` — isso é código do domínio `sessoes`. AD-1 fixa a direção de dependência como `reservas → sessoes` (nunca o inverso); se `AssentoSessaoRepository` vivesse em `reservas`, `sessoes` teria que depender de `reservas` pra popular a tabela na criação da sessão, violando o grafo. Colocar a entidade onde ela é escrita primeiro (não onde parece "pertencer" conceitualmente) é a única ordem que não viola AD-1 — `reservas` (Epic 3) vai poder chamar esse repository livremente sem quebrar nada, porque já depende de `sessoes`. Mesmo tratamento já dado ao pacote `sessoes.catalogo` na Story 1.2 (desvio documentado, não silencioso).

- [x] **Task 3 — SessaoService cria sessão com bloqueio de conflito de horário (AC1, AC2, AC3)**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (JUnit+Mockito puro, sem contexto Spring — mocka `SalaRepository`, `AssentoRepository`, `SessaoRepository`, `AssentoSessaoRepository`, `UsuarioRepository`) cobrindo: (a) caso feliz — data futura, sala existe e é travada, sem conflito → `Sessao` salva, `AssentoSessao` salvo em lote com `count == linhas*colunas`, todos `LIVRE`, resposta com `capacidade` correta (AC1); (b) data no passado → lança `DataHoraNoPassadoException` **e** `salaRepository.findByIdForUpdate` nunca é chamado (prova que a validação roda antes de travar a linha — falha rápido, crítica mais curta, AD-5) (AC2); (c) `existeConflitante` retorna `true` → lança `SessaoConflitanteException`, **e** o lock da sala foi pedido antes (prova que o lock cobre a checagem de conflito, não é só validação isolada de app) e `sessaoRepository.save` nunca é chamado (AC3); (d) sala inexistente → `SalaNaoEncontradaException`. Rodar e confirmar que falha por `SessaoService`/as exceptions ainda não existirem.
  - [x] **[GREEN]** Criar as exceptions em `br.com.rolo35.api.sessoes` (raiz do pacote, `RuntimeException` simples, mesmo padrão de `CredenciaisInvalidasException`): `SessaoConflitanteException`, `DataHoraNoPassadoException`, `SalaNaoEncontradaException`. Criar `service/SessaoService.java`, método `@Transactional criar(CriarSessaoRequest request, String organizadorEmail)`, algoritmo nesta ordem exata: (1) validar `request.dataHora().isAfter(LocalDateTime.now())` — se não, `DataHoraNoPassadoException` **antes** de qualquer lock; (2) resolver `organizadorId` via `UsuarioRepository.findByEmail` (dependência legítima `sessoes → auth`, AD-1); (3) `salaRepository.findByIdForUpdate(salaId)` — se vazio, `SalaNaoEncontradaException`; dentro da mesma transação, emitir `SET LOCAL lock_timeout = '3s'` via `EntityManager.createNativeQuery` logo antes dessa chamada (AD-5 pede timeout próprio e curto pra essa transação de lock — spike rápido pra confirmar que o `SET LOCAL` funciona limpo dentro de uma transação gerenciada pelo Spring); (4) com o lock em mãos, `sessaoRepository.existeConflitante(salaId, dataHora, 240)` — se `true`, `SessaoConflitanteException`; (5) `capacidade = sala.getLinhas() * sala.getColunas()`; (6) montar e salvar a `Sessao` (organizadorId, salaId, campos de snapshot TMDb vindos do request, dataHora, preco, createdAt); (7) `assentoRepository.findBySalaId(salaId)` → montar um `AssentoSessao` por assento com `status = "LIVRE"` → `assentoSessaoRepository.saveAll(...)`, mesma transação do passo 6 (cumpre AD-3 literalmente: linha por assento, mesma transação do insert da sessão); (8) retornar `SessaoResponse` (sessão persistida + `capacidade` + `sala.getNome()`). Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): SessaoService cria sessão com bloqueio de conflito de horário (AC1-3)`

- [x] **Task 4 — POST /api/sessoes com DTOs e envelope de erro (AC1, AC2, AC3)**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java` (`@WebMvcTest(controllers = SessaoController.class) @AutoConfigureMockMvc(addFilters = false) @Import(GlobalExceptionHandler.class)`, `SessaoService` mockado) cobrindo: corpo válido → `201` com o shape completo de `SessaoResponse` (AC1); service lança `DataHoraNoPassadoException` → `400` + `{codigo: "DATA_HORA_NO_PASSADO", ...}` (AC2); service lança `SessaoConflitanteException` → `409` + `{codigo: "SESSAO_CONFLITANTE", ...}` (AC3); corpo com `salaId` nulo ou `preco` negativo → `400` + `{codigo: "PARAMETRO_INVALIDO", ...}`. Rodar e confirmar que falha por `SessaoController`/DTOs/handlers ainda não existirem.
  - [x] **[GREEN]** Criar `dto/CriarSessaoRequest.java` (record: `salaId @NotNull Long`, `tmdbId @NotNull Long`, `titulo @NotBlank String`, `posterUrl String` nullable, `sinopse String` nullable, `dataEstreia String` nullable, `dataHora @NotNull LocalDateTime`, `preco @NotNull @Positive BigDecimal`) e `dto/SessaoResponse.java` (record: `id, salaId, salaNome, tmdbId, titulo, posterUrl, sinopse, dataEstreia, dataHora, preco, capacidade, organizadorId`). Criar `controller/SessaoController.java` (`@RestController @RequestMapping("/api/sessoes")`, `@PostMapping` recebe `@Valid @RequestBody CriarSessaoRequest` + `Authentication`, delega pro service passando `authentication.getName()` — resolver o id do organizador a partir do e-mail é responsabilidade do **service**, não do controller, que fica só de repasse, AD-1). Adicionar em `GlobalExceptionHandler`: handler pra `SessaoConflitanteException` → `409 SESSAO_CONFLITANTE`; `DataHoraNoPassadoException` → `400 DATA_HORA_NO_PASSADO`; `SalaNaoEncontradaException` → `404 SALA_NAO_ENCONTRADA`; e um handler novo pra `MethodArgumentNotValidException` → `400 PARAMETRO_INVALIDO` (esse handler não existia — hoje qualquer falha de `@Valid`, inclusive no `LoginRequest` já existente, cai no handler genérico e vira `500 ERRO_INTERNO` por engano; `CriarSessaoRequest` é o primeiro DTO desta story com validação de verdade, então o gap fica visível agora — o handler novo corrige os dois casos de graça, efeito colateral positivo, não é escopo novo pedido por nenhuma AC). Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): POST /api/sessoes com DTOs e envelope de erro (AC1-3)`

- [x] **Task 5 — GET /api/salas pra alimentar a seleção de sala**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/controller/SalaControllerTest.java` (`@WebMvcTest(SalaController.class) @AutoConfigureMockMvc(addFilters = false) @Import(GlobalExceptionHandler.class)`, `SalaService` mockado) cobrindo: `GET /api/salas` → `200` + lista de `SalaResumoDto` com `capacidade` derivada corretamente. Rodar e confirmar que falha.
  - [x] **[GREEN]** Criar `dto/SalaResumoDto.java` (record: `id, nome, capacidade`), `service/SalaService.java` (thin — `SalaRepository.findAll()` mapeado pra `SalaResumoDto`, `capacidade = linhas*colunas`), `controller/SalaController.java` (`GET /api/salas`, sem restrição de papel — cai no `anyRequest().authenticated()` já existente, mesmo tratamento dado a `/api/filmes/buscar` na Story 1.2). Justificativa de existir: sem isso a tela do organizador teria que hardcodar `salaId=1`, o que é código morto/fake que quebra silenciosamente no dia em que uma segunda sala for semeada — não é CRUD (sem POST/PUT/DELETE), nenhuma FR autoriza gestão de salas ainda, é só a infraestrutura mínima real pra AC1 funcionar de ponta a ponta pela UI. Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): GET /api/salas pra alimentar a seleção de sala`

- [x] **Task 6 — Restringe POST /api/sessoes a ORGANIZADOR com 403 no envelope padrão (AC5)**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java` — `@WebMvcTest(controllers = SessaoController.class)` **sem** `addFilters = false` (filtros de segurança reais ligados), `@Import({SecurityConfig.class, GlobalExceptionHandler.class})`, `SessaoService` mockado, `JwtService` real construído do mesmo jeito que `JwtAuthenticationFilterTest` já faz. Mintar tokens pra `ORGANIZADOR`, `CLIENTE`, `PORTARIA` e cobrir: token `ORGANIZADOR` com corpo válido → chega no service mockado, `201`; token `CLIENTE` ou `PORTARIA` → `403` + `{codigo: "NAO_AUTORIZADO", ...}`. Rodar e confirmar que falha (a regra ainda não existe, e o handler de 403 ainda não escreve o envelope certo).
  - [x] **[GREEN]** Em `SecurityConfig.java`, adicionar `.requestMatchers(HttpMethod.POST, "/api/sessoes").hasRole("ORGANIZADOR")` **antes** de `.anyRequest().authenticated()` (autoridade já vem como `ROLE_<papel>` do `JwtAuthenticationFilter` existente — `hasRole("ORGANIZADOR")` casa direto, sem mudança na filter). Criar `config/RestAccessDeniedHandler.java` implementando `AccessDeniedHandler` — escreve `{"codigo":"NAO_AUTORIZADO","mensagem":"..."}`, status `403`, `content-type: application/json` (o handler padrão do Spring Security responde 403 **antes** de chegar no `DispatcherServlet`, nunca passa pelo `GlobalExceptionHandler` — é a primeira vez que essa costura é tocada no projeto, então validar com calma que o `ObjectMapper` usado aqui serializa igual ao resto da API). Registrar via `.exceptionHandling(ex -> ex.accessDeniedHandler(new RestAccessDeniedHandler(objectMapper)))` em `securityFilterChain`. Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): restringe POST /api/sessoes a ORGANIZADOR com 403 no envelope padrão (AC5)`

- [x] **Task 7 — Concorrência de criação de sessão sob conflito de horário (AC4, Testcontainers)**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/SessaoConcorrenciaConflitoTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, `SessaoService` real injetado): duas threads (via `ExecutorService` + `CyclicBarrier` pra garantir início simultâneo) chamam `sessaoService.criar(...)` pra a **mesma** `salaId` (a sala seed "Sala 1") com `dataHora` sobreposta, usando um horário longe da sessão já semeada em `V2__seed.sql` (`now() + 7 dias`) — usar `now() + 30 dias` pra não colidir sem querer com o dado de seed. Assert: exatamente uma chamada retorna sucesso, a outra lança `SessaoConflitanteException`; consultar o banco direto ao final e confirmar que existe **exatamente uma** linha em `sessoes` pra essa sala nessa janela — não confiar só no resultado em memória das duas chamadas. Rodar e confirmar que passa só se a Task 3 realmente serializa via lock de banco (não checagem isolada de app) — se o teste passar mesmo comentando o lock, ele está fraco, ajustar.
  - [x] Se necessário algum ajuste em `SessaoService`/repositories pra o teste passar de forma determinística (ex.: garantir que o `lock_timeout` da Task 3 não derruba a segunda thread antes dela conseguir esperar o lock), aplicar aqui.
  - [x] Commit: `test(sessoes): concorrência de criação de sessão sob conflito de horário (AC4)`

- [ ] **Task 8 — Busca de filmes ganha ação de criar sessão**
  - [ ] Estender `web/src/pages/BuscaFilmesPage.tsx` (arquivo existente, ler por completo antes de mexer): cada card de resultado ganha um botão "Criar sessão" que chama `useNavigate()` (já usado em `LoginPage.tsx`, mesmo padrão) e navega pra `/organizador/sessoes/nova`, passando o filme selecionado via `state` da rota (`navigate('/organizador/sessoes/nova', { state: filme })`) — sem prop nova, sem componente wrapper.
  - [ ] Depois do componente ajustado: adicionar teste em `BuscaFilmesPage.test.tsx` (arquivo existente) cobrindo que clicar em "Criar sessão" navega levando o filme no state (renderizar dentro do mesmo `MemoryRouter` com uma rota sentinela pra capturar o state recebido, sem mockar internals do `react-router`).
  - [ ] Commit: `feat(sessoes): busca de filmes ganha ação de criar sessão`

- [ ] **Task 9 — Tela de criação de sessão (sala, data/hora, preço)**
  - [ ] Criar `web/src/api/sessoes.ts`: `criarSessao(request): Promise<Sessao>` (`POST /api/sessoes`) e `listarSalas(): Promise<Sala[]>` (`GET /api/salas`) — módulo único cobrindo os dois (não existe domínio `salas` separado na arquitetura, e um módulo inteiro só pra um GET seria cerimônia sem necessidade). Sem teste unitário dedicado — mesmo padrão de `filmes.ts` (wrapper simples, exercitado indiretamente pelo teste de contrato da página).
  - [ ] Criar `web/src/pages/CriarSessaoPage.tsx`: lê o filme selecionado via `useLocation().state`; se ausente (navegação direta/refresh), mostra mensagem de guarda em vez de quebrar. No mount, chama `listarSalas()` com estados `idle/loading/vazio/erro` (NFR-1). Form: `<select>` de sala (populado por `listarSalas()`), `<input type="datetime-local">` pra `dataHora`, `<input type="number">` pra `preco`. Submit combina os campos de snapshot do filme (vindos do route state) + campos do form em `criarSessao(...)`; máquina de estado `idle/loading/sucesso/erro`, mesmo padrão de `LoginPage`/`BuscaFilmesPage`. Sucesso: estado inline de confirmação com link "voltar à busca" (não existe tela de listagem de sessões ainda — Story 2.3 cobre isso). Usa só os tokens Tailwind já definidos (`bg-sepia-950`, `font-display`, `text-amber-300`, `border-gold-500`, etc.) — sem cor nova.
  - [ ] Trocar em `web/src/App.tsx`: adicionar `<Route path="/organizador/sessoes/nova" element={<CriarSessaoPage />} />`; rota `/organizador` continua `<BuscaFilmesPage />`, sem mudança nela.
  - [ ] Depois do componente pronto: `CriarSessaoPage.test.tsx` (vitest + testing-library) — mocka `api/sessoes.ts`, cobre estados idle/loading/vazio/erro da busca de salas, formato do payload de submit, estados sucesso/erro pós-submit, guarda de state ausente.
  - [ ] Commit: `feat(sessoes): tela de criação de sessão (sala, data/hora, preço)`

- [ ] **Task 10 — Confirmação final (sem código novo, checklist de saída)**
  - [ ] Rodar a suíte completa (back-end `mvn test`, incluindo os testes com Testcontainers; front-end `npm test`, `npm run build`, `npm run lint`) e confirmar tudo verde.
  - [ ] Registrar em `docs/decisions.md`: posição de `AssentoSessao` em `sessoes` (não `reservas`) e por quê; mecanismo de `lock_timeout` via `SET LOCAL` dentro da transação; justificativa de `GET /api/salas`; o fix incidental de `MethodArgumentNotValidException` no `GlobalExceptionHandler`.
  - [ ] Atualizar o Status desta story pra `done` (ou `review`, se o fluxo do projeto passar por `code-review` antes — seguir o mesmo ciclo já usado nas Stories 1.1/1.2).
  - [ ] Commit: `docs(sessoes): confirmação final e fecha Story 2.1 pra review`

## Dev Notes

- **`sessoes` já existe como pacote, só com `catalogo/` dentro (Story 1.2).** Esta story adiciona o domínio de verdade — entidades, `controller/service/repository` completos —, seguindo a estrutura padrão do CLAUDE.md (`sessoes.catalogo` foi um desvio documentado e deliberado só pro proxy TMDb; o resto do pacote segue a regra normal de camadas).

- **`Sessao` é a primeira entidade do projeto de fato construída por código de aplicação.** Todas as entidades existentes (`Usuario`) só são lidas — nunca escritas fora de SQL de seed. Não existe precedente de builder/construtor mutável no projeto pra copiar; usar `@Builder` do Lombok junto de `@Getter @NoArgsConstructor` é a escolha mais limpa, sem inventar um padrão novo de setters.

- **Capacidade nunca é persistida.** O schema (`V1__schema.sql`) não tem coluna `capacidade` em `sessoes` — é sempre `sala.linhas * sala.colunas`, calculada no momento da criação (response) e, futuramente, em qualquer outra leitura que precise dela. Isso é o que garante a AC1 ("não um número digitado livremente").

- **Buffer fixo de 4h (AD-3), não runtime real do filme.** A Architecture Spine já marca isso como simplificação deliberada (seção Deferred): nenhum filme real dura 4h, e capturar runtime do TMDb exigiria mudar o snapshot de `AD-14`. `bufferMinutos = 240` vive como constante única dentro de `SessaoService`, nunca duplicada na query nativa (ela recebe o valor como parâmetro).

- **Ordem lock → validação, invertida deliberadamente.** O texto da Architecture Spine descreve "trava a sala, então checa sobreposição"; esta story valida "data no passado" **antes** de tentar qualquer lock, porque isso é puro fail-fast sobre o próprio request (não depende de estado do banco) e mantém a transação de lock mais curta possível, alinhado com AD-5 ("nenhuma escrita não relacionada dentro dela" — e, por extensão, nenhum trabalho evitável). A checagem de sobreposição em si continua acontecendo com o lock da sala já em mãos, exatamente como AD-3 pede.

- **`lock_timeout` (AD-5).** Emitir `SET LOCAL lock_timeout = '3s'` via `EntityManager` nativo, dentro da mesma transação `@Transactional` que faz o `SELECT ... FOR UPDATE` — não depender de um hint JPA (`jakarta.persistence.lock.timeout`) sem verificação prévia de que ele se traduz certo pro Postgres nesta combinação de Hibernate/Spring Boot 4.1. Validar isso cedo na Task 3 (pequeno spike manual: comentar o `SET LOCAL`, confirmar que sem ele uma segunda transação trava indefinidamente esperando lock; com ele, falha em ~3s) antes de dar a task por pronta.

- **`AssentoSessao` em `sessoes`, não em `reservas` — desvio documentado do Structural Seed.** Ver justificativa completa na Task 2 acima. Resumo: AD-1 (direção de dependência `reservas → sessoes`) torna estruturalmente impossível `sessoes` escrever em um repository que pertencesse a `reservas`, e AD-3 exige que a escrita aconteça na mesma transação da criação da sessão — código do domínio `sessoes`. Registrar em `docs/decisions.md` na Task 10.

- **`GET /api/salas` não é uma FR explícita — é infraestrutura necessária pra AC1 funcionar de ponta a ponta pela UI.** Só listagem (sem CRUD), autenticado (sem restrição de papel, mesmo tratamento de `/api/filmes/buscar` na Story 1.2 — a AC5 desta story só restringe o `POST /api/sessoes`, não a leitura de salas).

- **Fix incidental do `MethodArgumentNotValidException`.** Hoje (antes desta story), qualquer falha de `@Valid` em qualquer DTO do projeto (inclusive `LoginRequest`, já existente) cai no handler genérico `Exception.class` do `GlobalExceptionHandler` e retorna `500 ERRO_INTERNO` em vez de `400`. `CriarSessaoRequest` é o primeiro DTO desta story com validação de verdade (`@NotNull`, `@Positive`), então o handler dedicado que a Task 4 adiciona corrige os dois casos ao mesmo tempo — mudança puramente aditiva, sem regressão, mas vale registrar porque o blast radius toca o domínio `auth` de raspão.

- **AC5 e o envelope de erro do Spring Security.** O `AccessDeniedHandler` padrão do Spring Security responde `403` antes de o request chegar no `DispatcherServlet` — nunca passa pelo `@RestControllerAdvice`. Sem um handler próprio, a AC5 ainda "funcionaria" (retornaria 403), mas quebraria o envelope único `{codigo, mensagem}` que AD-11 exige em toda resposta de erro da API. `RestAccessDeniedHandler` (Task 6) é a primeira vez que essa costura é tocada no projeto — verificar durante a implementação que o `ObjectMapper` usado nela serializa exatamente como o resto (mesmo `ApiError` record).

- **Testcontainers restrito ao que o CLAUDE.md já reserva.** A tabela de estratégia de teste do projeto reserva Testcontainers pros dois cenários de concorrência (assento, ingresso) + smoke tests de repository. FR-6/AC4 desta story é exatamente um desses cenários de concorrência — a Task 7 não é opcional, é o teste que efetivamente prova que o lock é de banco e não checagem isolada de aplicação (um teste que só chama o service duas vezes sequencialmente, sem concorrência real, não provaria nada sobre a garantia da AC4).

- **Campos FK simples (`Long`), sem `@ManyToOne`.** Consistente com o único precedente existente (`Usuario`, sem relações). Story 2.3 (listagem pública, precisa de fetch join sessão+filme+sala pra evitar N+1 por NFR-9) pode precisar reconsiderar isso — não é um problema desta story, só um ponto de atenção pra quem for escrever 2.3.

- **Sem tela de listagem de sessões ainda (Story 2.3).** `CriarSessaoPage` não tem pra onde navegar depois de criar com sucesso além de voltar pra busca — é esperado, não uma lacuna desta story.

## Project Structure Notes

- Segue a estrutura já fixada na Architecture Spine (Structural Seed, Capability → Architecture Map), com o desvio documentado de `AssentoSessao` (ver Dev Notes acima).
- **Back-end (novo)**: `api/src/main/resources/db/migration/V3__indice_sessoes_sala_data_hora.sql`; `api/src/main/java/br/com/rolo35/api/sessoes/{Sala,Assento,Sessao,AssentoSessao,AssentoSessaoId,SessaoConflitanteException,DataHoraNoPassadoException,SalaNaoEncontradaException}.java`; `.../sessoes/repository/{SalaRepository,AssentoRepository,SessaoRepository,AssentoSessaoRepository}.java`; `.../sessoes/service/{SessaoService,SalaService}.java`; `.../sessoes/controller/{SessaoController,SalaController}.java`; `.../sessoes/dto/{CriarSessaoRequest,SessaoResponse,SalaResumoDto}.java`; `.../config/RestAccessDeniedHandler.java`; testes em `api/src/test/java/br/com/rolo35/api/sessoes/{SalaAssentoRepositorySmokeTest,SessaoSecurityTest,SessaoConcorrenciaConflitoTest}.java`, `.../sessoes/service/SessaoServiceTest.java`, `.../sessoes/controller/{SessaoControllerTest,SalaControllerTest}.java`.
- **Back-end (update)**: `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java`; `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java`.
- **Front-end (novo)**: `web/src/api/sessoes.ts`; `web/src/pages/CriarSessaoPage.tsx`; `web/src/pages/CriarSessaoPage.test.tsx`.
- **Front-end (update)**: `web/src/pages/BuscaFilmesPage.tsx`; `web/src/pages/BuscaFilmesPage.test.tsx`; `web/src/App.tsx`.
- **Documentação (update)**: `docs/decisions.md`.
- **Leitura obrigatória antes de codar** (arquivos UPDATE, não criar do zero): `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` e `ApiError.java`, `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java`, `web/src/pages/BuscaFilmesPage.tsx` e seu teste, `web/src/App.tsx`, `web/src/api/client.ts` e `filmes.ts` — todos já lidos por completo durante a criação desta story (estado pós Story 1.2), conteúdo atual descrito em Dev Notes acima e no arquivo da Story 1.2.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Criação de Sessão com Bloqueio de Conflito de Horário]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-1, AD-3, AD-5, AD-10, AD-11, AD-12, AD-13, AD-14, Capability → Architecture Map §4.3, Structural Seed, Deferred]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#FR-5, FR-6]
- [Source: CLAUDE.md — Metodologia XP + TDD, Non-negotiables de Segurança/Modelagem/Qualidade, Convenções de nomenclatura]
- [Source: _bmad-output/implementation-artifacts/1-2-busca-de-filmes-via-proxy-tmdb.md — padrões de `client.ts`, `GlobalExceptionHandler`, estrutura de teste de página, formato de Dev Notes e commits por task]
- [Source: api/src/main/resources/db/migration/V1__schema.sql, V2__seed.sql — schema já existente de `salas`, `assentos`, `sessoes`, `assento_sessao`, seed de "Sala 1" e sessão placeholder em `now()+7dias`]
- [Source: código existente lido por completo nesta criação de story: `br.com.rolo35.api.auth.*`, `br.com.rolo35.api.sessoes.catalogo.*`, `br.com.rolo35.api.common.*`, `br.com.rolo35.api.config.SecurityConfig`, `TestcontainersConfiguration`, `web/src/pages/BuscaFilmesPage.tsx`, `web/src/App.tsx`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Task 1: criado índice composto `idx_sessoes_sala_id_data_hora` em `sessoes(sala_id, data_hora)` via V3. Índices simples existentes (`idx_sessoes_sala_id`, `idx_sessoes_data_hora`) mantidos intactos.
- Task 2: entidades `Sala`, `Assento`, `Sessao` (com `@Builder`, primeira do projeto), `AssentoSessaoId`/`AssentoSessao` criadas na raiz de `br.com.rolo35.api.sessoes`. Repositories em `sessoes/repository`: `SalaRepository.findByIdForUpdate` (lock pessimista), `AssentoRepository.findBySalaId`, `SessaoRepository.existeConflitante` (query nativa com aritmética de `INTERVAL`), `AssentoSessaoRepository`. `Sessao` precisou de `@AllArgsConstructor` explícito além de `@NoArgsConstructor`/`@Builder` — Lombok não gera o all-args automaticamente quando já existe outro construtor declarado na classe. Smoke test `SalaAssentoRepositorySmokeTest` verde (Flyway aplica V1-V3, seed da Sala 1 com 40 assentos confirmado).
- Task 3: `SessaoService.criar` implementado seguindo a ordem exata do algoritmo (fail-fast data no passado antes de qualquer lock → resolve organizador → `SET LOCAL lock_timeout='3s'` via `EntityManager` nativo, logo antes do `SELECT...FOR UPDATE` da sala → checa conflito com o lock já em mãos → deriva capacidade → salva `Sessao` → monta e salva `AssentoSessao` em lote, todos `LIVRE`, na mesma transação). `CriarSessaoRequest`/`SessaoResponse` (`sessoes/dto`) precisaram existir já nesta task por dependência de assinatura do service — sem anotações de Bean Validation ainda, essas entram na Task 4 junto com o controller. `SessaoServiceTest` (Mockito puro) cobre os 4 cenários da AC1-3: caso feliz (capacidade 40, todos os `AssentoSessao` `LIVRE`), data no passado sem travar a sala, conflito após travar a sala sem salvar sessão, e sala inexistente. A validação do spike de `SET LOCAL lock_timeout` dentro de uma transação `@Transactional` real do Spring fica pra Task 7 (Testcontainers), já que este teste é só Mockito e não toca banco de verdade.
- Task 4: `SessaoController` (`POST /api/sessoes`, `@Valid @RequestBody` + `Authentication`, `ResponseEntity` com `201`) e `GlobalExceptionHandler` ganhou handlers pra `SessaoConflitanteException` (409), `DataHoraNoPassadoException` (400), `SalaNaoEncontradaException` (404) e agrupou `MethodArgumentNotValidException` no handler existente de `PARAMETRO_INVALIDO` (fix incidental do gap que já afetava `LoginRequest`). `CriarSessaoRequest` ganhou as anotações de Bean Validation (`@NotNull`/`@NotBlank`/`@Positive`) que faltavam desde a Task 3. No teste do controller, `.principal(new UsernamePasswordAuthenticationToken(email, null))` foi usado pra injetar o `Authentication` em vez de `SecurityMockMvcRequestPostProcessors.user(...)` — com `addFilters = false` e sem `@Import(SecurityConfig.class)` nesta task, o postprocessor de spring-security-test não populava o `SecurityContextHolder` (confirmado via NPE reproduzido e depois corrigido); `.principal(...)` seta o principal direto na request mockada, sem depender da cadeia de filtros — Task 6 é quem de fato exercita a filter chain real.
- Task 5: `GET /api/salas` sem restrição de papel (cai no `anyRequest().authenticated()` já existente). `SalaService` thin mapeia `SalaRepository.findAll()` pra `SalaResumoDto` com `capacidade = linhas*colunas`. Existe pra a tela do organizador não precisar hardcodar `salaId=1`.
- Task 6: `SecurityConfig` ganhou `.requestMatchers(HttpMethod.POST, "/api/sessoes").hasRole("ORGANIZADOR")` antes do `.anyRequest().authenticated()`. `RestAccessDeniedHandler` novo (`config/`) escreve o envelope `{codigo: "NAO_AUTORIZADO", mensagem}` em `403`, registrado via `.exceptionHandling(ex -> ex.accessDeniedHandler(...))`. `securityFilterChain` ganhou um terceiro parâmetro `ObjectMapper` (auto-configurado pelo Spring Boot, `tools.jackson.databind.ObjectMapper`) pra construir o handler. `SessaoSecurityTest` sobe `@WebMvcTest` com filtros de segurança reais (`@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})`, sem `addFilters = false`), autowira o `JwtService` real do contexto (mesma instância que a `securityFilterChain` usa, evita divergência de secret) pra mintar tokens ORGANIZADOR/CLIENTE/PORTARIA — RED confirmado antes (CLIENTE/PORTARIA chegavam a 201 sem a regra).
- Task 7: `SessaoConcorrenciaConflitoTest` (Testcontainers, `SessaoService` real) dispara duas threads via `ExecutorService`+`CyclicBarrier(2)` pro mesmo `salaId` (Sala 1, lida via `salaRepository.findAll()` em vez de hardcodar id) com `dataHora` idêntico em `now()+30 dias` (longe do seed em `+7 dias`). Verificação de força do teste feita manualmente: trocado temporariamente `findByIdForUpdate` por `findById` (sem lock) — o teste falhou como esperado (2 sessões criadas em vez de 1), confirmando que ele só passa por causa do lock de banco real, não por sorte de timing; revertido antes do commit. Nenhum ajuste em `SessaoService`/repositories foi necessário — o `lock_timeout` de 3s da Task 3 nunca é atingido nesse cenário porque a segunda thread espera só o tempo da primeira transação completar (~dezenas de ms). Consulta direta ao banco ao final confirma exatamente 1 linha em `sessoes` pra essa sala+horário.

### File List

- `api/src/main/resources/db/migration/V3__indice_sessoes_sala_data_hora.sql` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/Sala.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/Assento.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/Sessao.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/AssentoSessaoId.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/AssentoSessao.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/SalaRepository.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoRepository.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (novo)
- `api/src/test/java/br/com/rolo35/api/sessoes/SalaAssentoRepositorySmokeTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/SessaoConflitanteException.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/DataHoraNoPassadoException.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/SalaNaoEncontradaException.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/CriarSessaoRequest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/SessaoResponse.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java` (novo)
- `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/controller/SessaoController.java` (novo)
- `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/CriarSessaoRequest.java` (update: anotações de Bean Validation)
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update: handlers de SessaoConflitanteException, DataHoraNoPassadoException, SalaNaoEncontradaException, MethodArgumentNotValidException)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/SalaResumoDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/service/SalaService.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/controller/SalaController.java` (novo)
- `api/src/test/java/br/com/rolo35/api/sessoes/controller/SalaControllerTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/config/RestAccessDeniedHandler.java` (novo)
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (update: hasRole("ORGANIZADOR") em POST /api/sessoes, exceptionHandling com RestAccessDeniedHandler)
- `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java` (novo)
- `api/src/test/java/br/com/rolo35/api/sessoes/SessaoConcorrenciaConflitoTest.java` (novo)
