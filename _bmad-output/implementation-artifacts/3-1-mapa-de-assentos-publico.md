---
baseline_commit: 7a12d86
---

# Story 3.1: Mapa de Assentos Público

Status: review

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a visitante (sem login),
I want ver o mapa de assentos de uma sessão específica,
so that eu decida se quero reservar antes mesmo de criar conta.

## Acceptance Criteria

1. **Given** uma sessão publicada com assentos em estados variados (livre, hold ativo, vendido) **When** o mapa de assentos da sessão é consultado sem token **Then** retorna todos os assentos com seu estado (`LIVRE` / `RESERVADO` / `VENDIDO`), sem exigir autenticação.
2. **Given** o mapa retornado **When** inspecionado **Then** não inclui identidade do cliente que reservou ou comprou nenhum assento (sem `reservaId`, sem `clienteId`, sem e-mail/nome — só `id`, `fileira`, `numero`, `status`).
3. **Given** um hold de 10 min já expirado **When** o mapa é consultado (TTL calculado lazy a partir de `expires_at`, sem job agendado — AD-4) **Then** o assento aparece como `LIVRE` novamente (a linha `assento_sessao` continua com `status=RESERVADO` no banco — o cálculo é só na leitura, sem escrita).
4. **Given** uma sessão inexistente **When** o mapa é consultado **Then** retorna `404` com envelope `{codigo: "SESSAO_NAO_ENCONTRADA", mensagem}`, e o front-end mostra estado de erro.
5. **Given** o mapa em carregamento no front-end **When** a requisição ainda não retornou **Then** mostra estado de carregamento.

## Tasks / Subtasks

- [x] **Task 1 — Query de mapa sem N+1: `AssentoSessaoRepository.buscarMapaPorSessao()` via JPQL (AC1, AC2)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoMapaRepositoryTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `SessaoListagemRepositoryTest`/`SalaAssentoRepositorySmokeTest`): popular uma sessão numa sala pequena (ex. `linhas=2, colunas=2`, 4 assentos) com um `assento_sessao` em cada estado (`LIVRE`, `RESERVADO` com `expires_at` no futuro, `VENDIDO`) e um quarto `RESERVADO` com `expires_at` no passado. Assert de shape puro (sem lógica de TTL aqui, isso é do service): 4 linhas retornadas, `assentoId`/`fileira`/`numero`/`status`/`expiresAt` batendo com o fixture, ordenadas por `fileira, numero`. Rodar e confirmar que falha por `buscarMapaPorSessao()`/`AssentoMapaProjection` ainda não existirem.
  - [x] **[GREEN]** Criar `repository/AssentoMapaProjection.java` (interface Spring Data, getters `Long getAssentoId()`, `String getFileira()`, `Integer getNumero()`, `String getStatus()`, `java.time.LocalDateTime getExpiresAt()`). Adicionar em `AssentoSessaoRepository`:
    ```java
    @Query("""
        SELECT a.id AS assentoId, a.fileira AS fileira, a.numero AS numero,
               asx.status AS status, asx.expiresAt AS expiresAt
        FROM AssentoSessao asx JOIN Assento a ON a.id = asx.id.assentoId
        WHERE asx.id.sessaoId = :sessaoId
        ORDER BY a.fileira, a.numero
        """)
    List<AssentoMapaProjection> buscarMapaPorSessao(Long sessaoId);
    ```
    JPQL (não SQL nativo) com `JOIN ... ON` explícito entre `AssentoSessao` e `Assento` — as duas entidades não têm associação `@ManyToOne` mapeada entre si (`AssentoSessaoId` guarda `sessaoId`/`assentoId` como `Long` soltos, decisão da Story 2.1 pra manter o `Persistable` customizado que evita `SELECT` antes de cada `INSERT` no `saveAll()` em lote — ver Dev Notes). O `JOIN ... ON` do JPQL (suportado desde JPA 2.1) faz esse join sem precisar de relação mapeada nem de SQL nativo — mais portável e validado pelo Hibernate contra o metamodelo, ao contrário de `nativeQuery = true`. Uma única query, sem N+1 (non-negotiable do CLAUDE.md). Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): AssentoSessaoRepository.buscarMapaPorSessao() sem N+1 (AC1-2)`

- [x] **Task 2 — `SessaoService.mapaAssentos()` calcula status efetivo via TTL lazy (AC1-4)**
  - [x] **[RED]** Estender `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (Mockito puro, mocka `SessaoRepository`, `SalaRepository`, `AssentoSessaoRepository`) cobrindo: sessão existente com sala existente → `MapaAssentosDto` populado, `RESERVADO` com `expiresAt` futuro permanece `RESERVADO`, `RESERVADO` com `expiresAt` no passado vira `LIVRE` no DTO (sem chamar nenhum método de escrita no repository — nenhum `save`/`saveAll` invocado, prova que é só leitura), `VENDIDO` permanece `VENDIDO`; sessão inexistente → `SessaoNaoEncontradaException`. Rodar e confirmar que falha por `mapaAssentos()`/`MapaAssentosDto`/`AssentoMapaDto` ainda não existirem.
  - [x] **[GREEN]** Criar `dto/AssentoMapaDto.java` (record: `id, fileira, numero, status` — sem `reservaId`/`expiresAt` no DTO público, é detalhe interno de cálculo, AC2). Criar `dto/MapaAssentosDto.java` (record: `sessaoId, titulo, posterUrl, salaNome, dataHora, preco, assentos: List<AssentoMapaDto>` — contexto suficiente pra tela renderizar sozinha, mesmos campos já expostos em `SessaoListagemDto`). Adicionar `SessaoService.mapaAssentos(Long sessaoId): MapaAssentosDto`:
    ```java
    public MapaAssentosDto mapaAssentos(Long sessaoId) {
        Sessao sessao = sessaoRepository.findById(sessaoId).orElseThrow(SessaoNaoEncontradaException::new);
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        LocalDateTime agora = LocalDateTime.now();
        List<AssentoMapaDto> assentos = assentoSessaoRepository.buscarMapaPorSessao(sessaoId).stream()
                .map(p -> new AssentoMapaDto(p.getAssentoId(), p.getFileira(), p.getNumero(), statusEfetivo(p, agora)))
                .toList();
        return new MapaAssentosDto(
                sessao.getId(), sessao.getTitulo(), sessao.getPosterUrl(), sala.getNome(),
                sessao.getDataHora(), sessao.getPreco(), assentos);
    }

    private String statusEfetivo(AssentoMapaProjection projecao, LocalDateTime agora) {
        boolean holdVencido = STATUS_RESERVADO.equals(projecao.getStatus())
                && projecao.getExpiresAt() != null
                && projecao.getExpiresAt().isBefore(agora);
        return holdVencido ? STATUS_LIVRE : projecao.getStatus();
    }
    ```
    Adicionar constante `STATUS_RESERVADO = "RESERVADO"` ao lado da já existente `STATUS_LIVRE`. Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): SessaoService.mapaAssentos() com TTL lazy (AC1, AC3-4)`

- [x] **Task 3 — `GET /api/sessoes/{id}/mapa-assentos` público, sem autenticação (AC1, AC4)**
  - [x] **[RED]** Estender `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java`: `GET /api/sessoes/{id}/mapa-assentos` → `200` + shape de `MapaAssentosDto` (incluindo array `assentos` com `id/fileira/numero/status`, sem qualquer campo de identidade de cliente); service lança `SessaoNaoEncontradaException` → `404` com `{codigo: "SESSAO_NAO_ENCONTRADA"}` (reaproveita o handler já existente, sem exceção nova). Estender `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java` com um caso **sem token nenhum** → `200` no service mockado (RED que prova a lacuna, mesmo padrão do teste equivalente de `GET /api/sessoes` da Story 2.3). Rodar e confirmar que falha.
  - [x] **[GREEN]** Adicionar em `SessaoController`:
    ```java
    @GetMapping("/{id}/mapa-assentos")
    public ResponseEntity<MapaAssentosDto> mapaAssentos(@PathVariable Long id) {
        return ResponseEntity.ok(sessaoService.mapaAssentos(id));
    }
    ```
    Sem `@PreAuthorize` — rota pública. Em `SecurityConfig`, adicionar **outra** entrada `.requestMatchers(HttpMethod.GET, "/api/sessoes/*/mapa-assentos").permitAll()` antes de `.anyRequest().authenticated()` — **não** ampliar o matcher existente pra `/api/sessoes/**`, porque isso liberaria `GET /api/sessoes/{id}` (rota de gestão, exige `ORGANIZADOR`) e `GET /api/sessoes/minhas` sem querer. `/*/` casa exatamente um segmento de path (o `{id}`), sem alcançar `/minhas` nem sub-rotas mais profundas. Rodar os testes até passar.
  - [x] Commit: `feat(sessoes): GET /api/sessoes/{id}/mapa-assentos público sem autenticação (AC1, AC4)`

- [x] **Task 4 — Tela de mapa de assentos (AC1, AC4, AC5)**
  - [x] Estender `web/src/api/sessoes.ts`: adicionar `interface AssentoMapa { id: number; fileira: string; numero: number; status: 'LIVRE' | 'RESERVADO' | 'VENDIDO' }`, `interface MapaAssentos { sessaoId: number; titulo: string; posterUrl: string | null; salaNome: string; dataHora: string; preco: number; assentos: AssentoMapa[] }` e `buscarMapaAssentos(id: number): Promise<MapaAssentos>` (`GET /api/sessoes/${id}/mapa-assentos`) — sem `Authorization`, mesmo raciocínio de `listarSessoesPublicadas` (Story 2.3): `apiFetch` só anexa o header se houver token, visitante sem login não tem.
  - [x] Criar `web/src/pages/MapaAssentosPage.tsx`: lê `id` da URL via `useParams` (rota nova abaixo), no mount chama `buscarMapaAssentos(id)` com máquina de estado `loading/erro/nao-encontrado/pronto` (mesmo padrão de `FilmeDetalhePage`/`ListagemSessoesPage`, `role="alert"` no erro). `ApiRequestError.status === 404` → estado `nao-encontrado` (mensagem "sessão não encontrada"); qualquer outra falha → `erro` genérico (AC4). Renderiza cabeçalho com `titulo`/`salaNome`/`dataHora`/`preco`, e a grade de assentos agrupada por `fileira` — cada assento é um elemento não-clicável (seleção/reserva é escopo da Story 3.2, **não implementar aqui**) com estilo distinto por `status`: `LIVRE` destacado (ex. borda ciano `border-cyan-400`), `RESERVADO`/`VENDIDO` neutralizado (ex. `bg-ink-950/40`, `cursor-not-allowed`, sem hover) — usa só os tokens Tailwind já definidos no projeto (`bg-ink-950`, `font-display`, `text-flame-600`, `border-cyan-400`, `font-mono`, etc.), sem cor nova. Uma legenda simples (livre/reservado/vendido) abaixo do cabeçalho ajuda a leitura, mas não é AC — não expandir escopo além disso.
  - [x] Em `web/src/pages/FilmeDetalhePage.tsx`: trocar `escolherHorario` — em vez de `navigate('/em-construcao', {...})`, `navigate(`/sessoes/${sessao.id}/assentos`)`. Remove a dependência de `/em-construcao` só pra essa ação; a rota genérica de placeholder continua existindo pra `/portaria` e outros casos futuros, sem mudança ali.
  - [x] Em `web/src/App.tsx`: adicionar `<Route path="/sessoes/:id/assentos" element={<MapaAssentosPage />} />` dentro do `<Route element={<Layout />}>`, ao lado de `/filmes/:tmdbId`.
  - [x] Depois do componente pronto: `MapaAssentosPage.test.tsx` (vitest + testing-library) — mocka `api/sessoes.ts`, cobre estados `loading/erro/nao-encontrado/pronto`, e que cada assento renderiza com o status correto (contrato de comportamento, não pixel/CSS).
  - [x] Commit: `feat(sessoes): tela de mapa de assentos (AC1, AC4-5)`

- [x] **Task 5 — Confirmação final (sem código novo, checklist de saída)**
  - [x] Rodar a suíte completa (back-end `mvn test`, incluindo o teste Testcontainers da Task 1; front-end `npm test`, `npm run build`, `npm run lint`) e confirmar tudo verde.
  - [x] Registrar em `docs/decisions.md`: (a) por que o TTL lazy do mapa não escreve no banco na leitura (AD-4 é explícito — só o caminho de escrita, que chega na Story 3.2, precisa reivindicar o assento de verdade); (b) por que o `permitAll()` usa `/api/sessoes/*/mapa-assentos` em vez de ampliar `/api/sessoes/**`; (c) por que `buscarMapaPorSessao()` usa JPQL com `JOIN ... ON` em vez de `nativeQuery = true`, apesar do precedente de `listarPublicadas()` (Story 2.3) — sem agregação, JPQL tipado é suficiente e evita SQL amarrado ao dialeto do Postgres.
  - [x] Atualizar o Status desta story pra `review` (mesmo ciclo já usado nas Stories 1.1/1.2/2.1/2.3: code-review antes de `done`).
  - [x] Commit: `docs(sessoes): confirmação final e fecha Story 3.1 pra review`

## Dev Notes

- **Sem escrita nesta story.** AD-4 (TTL de reserva por status efetivo lazy) é explícito: "todo lugar que **lê ou escreve** o estado de um assento calcula o status efetivo a partir de `expires_at`". Esta story cobre só o caminho de **leitura** — o mapa nunca corrige a linha `assento_sessao` no banco, só computa o valor exibido. A reivindicação real de um hold vencido (liberar de fato pra outro cliente reservar) é atômica e acontece só no caminho de escrita da Story 3.2 (`SELECT ... FOR UPDATE`, AD-3). Não implementar nenhuma escrita/correção de estado aqui — está fora de escopo e duplicaria lógica que a 3.2 já vai centralizar sob lock.

- **`AssentoSessao`/`Assento` não têm `@ManyToOne` mapeado entre si — decisão preexistente, não mudar nesta story.** `AssentoSessaoId` (`@Embeddable`) guarda `sessaoId`/`assentoId` como `Long` soltos. Isso vem da Story 2.1: `AssentoSessao` implementa `Persistable<AssentoSessaoId>` com `isNew()` customizado justamente pra evitar que o Spring Data, vendo um `@EmbeddedId` não-nulo atribuído em código, trate o `save()` como `merge` (o que dispararia um `SELECT` por linha antes de cada `INSERT`). Isso importa porque `SessaoService.criar()`/`editar()` fazem `saveAll()` em lote (uma linha de `AssentoSessao` por assento da sala, podendo ser 40-140 linhas) **dentro da transação curta que segura o lock da sala** (AD-5). Migrar pra `@ManyToOne + @MapsId` tocaria esse ajuste de performance sem necessidade — esta story é só leitura. A query desta story (Task 1) resolve o join sem precisar de associação mapeada: JPQL suporta `JOIN Assento a ON a.id = asx.id.assentoId` (join explícito entre entidades, JPA 2.1+) navegando o embeddable (`asx.id.assentoId`) direto.

- **Por que JPQL e não `nativeQuery = true` (diferente do precedente de `listarPublicadas()`, Story 2.3).** `SessaoRepository.listarPublicadas()` usa SQL nativo porque precisa de `COUNT(DISTINCT ...)` + `CASE WHEN` em agregação, que não é natural em JPQL. A query desta story é um join simples sem agregação nenhuma — JPQL puro com `JOIN ... ON` cobre o caso sem abrir mão de portabilidade (não amarra a query à sintaxe do Postgres) nem de validação do Hibernate contra o metamodelo em tempo de build (SQL nativo só falha em runtime se um nome de coluna estiver errado). Não copiar o padrão `nativeQuery = true` da Story 2.3 por reflexo — cada query usa a ferramenta que o caso pede.

- **Não confundir com as rotas de gestão já existentes.** `GET /api/sessoes/{id}` (sem sufixo) já existe (Story 2.1/2.2) e é a rota do **organizador**, autenticada, retorna `SessaoGestaoDto` com `editavel`. Esta story adiciona uma rota **irmã**, não substitui nem estende essa: `GET /api/sessoes/{id}/mapa-assentos`, pública, DTO diferente (`MapaAssentosDto`). Os dois `@GetMapping` coexistem em `SessaoController` sem conflito (paths distintos).

- **`permitAll()` precisa ser específico, não `/api/sessoes/**`.** Ampliar o matcher existente pra cobrir qualquer sub-rota de `/api/sessoes/` tornaria `GET /api/sessoes/{id}` (gestão, `ORGANIZADOR`) e `GET /api/sessoes/minhas` públicos sem querer — regressão de segurança grave. O padrão `/api/sessoes/*/mapa-assentos` casa só o segmento exato (`{id}`), preservando as outras rotas atrás de `.anyRequest().authenticated()`. Mesmo cuidado que gerou o comentário explícito em `SecurityConfig` na Story 2.3 (dois grupos de `permitAll()` intencionalmente separados).

- **`AssentoMapaDto` não expõe `reservaId` nem `expiresAt`.** AC2 é explícito: nenhuma identidade de cliente vaza. `reserva_id` na tabela `assento_sessao` aponta pra uma linha de `reservas`, que por sua vez tem `cliente_id` — mesmo não sendo o e-mail/nome direto, expor `reservaId` cru permitiria correlacionar padrões de reserva entre requisições. `expiresAt` também fica de fora do DTO público — é detalhe de implementação do cálculo lazy, não informação que o visitante precisa (ele só precisa saber "livre" ou não, não o timestamp exato de expiração de outra pessoa).

- **Ordenação por `fileira, numero`.** Mesmo critério de legibilidade de qualquer mapa de cinema (fileira A antes de B, assento 1 antes de 2 dentro da fileira) — não é uma AC explícita, mas é o único critério que faz um mapa de assentos ser lido como mapa. A query JPQL já ordena, evitando reordenação em memória no service ou no front.

- **`MapaAssentosDto` carrega contexto de sessão (título, sala, data/hora, preço), não só a lista de assentos.** Nenhuma AC pede isso explicitamente, mas a tela (`MapaAssentosPage`) precisa ser navegável por link direto (`/sessoes/{id}/assentos`) sem depender de `state` de navegação vindo de `FilmeDetalhePage` — refresh de página ou link compartilhado têm que continuar funcionando. Mesmo padrão já usado em `SessaoGestaoDto`/`SessaoListagemDto`: DTO de tela carrega tudo que a tela precisa pra se bastar sozinha.

- **Sem seleção/clique nesta story.** A Story 3.2 ("Reserva de Assentos com Hold Temporário") é quem adiciona interação (seleção de 1-6 assentos, confirmação, hold). Os elementos de assento nesta story são informativos, não-clicáveis — não antecipar estado de seleção, formulário ou chamada de reserva. Antecipar isso agora só criaria código morto até a 3.2 chegar (non-negotiable de qualidade do CLAUDE.md).

- **Estado `nao-encontrado` distinto de `erro` no front.** Segue o mesmo padrão já usado em `FilmeDetalhePage` (`'nao-encontrado'` quando a lista filtrada vem vazia) — aqui a distinção vem do `status` de `ApiRequestError` (`client.ts` já lança essa classe com `.status`), não de uma lista vazia. `404` → mensagem "sessão não encontrada"; qualquer outro erro (`500`, rede, timeout) → mensagem genérica de falha ao carregar (AC4 pede só "estado de erro", mas separar as duas mensagens é UX melhor e não custa AC extra).

### Project Structure Notes

- Segue a estrutura já fixada na Architecture Spine (mesma usada pelas Stories 2.1/2.3), sem desvio novo. Não cria o domínio `reservas/` ainda — essa story é inteiramente leitura dentro de `sessoes/` (AD-1: `reservas` só nasce quando houver escrita real de reserva, Story 3.2).
- **Back-end (novo)**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoMapaProjection.java`; `api/src/main/java/br/com/rolo35/api/sessoes/dto/AssentoMapaDto.java`; `api/src/main/java/br/com/rolo35/api/sessoes/dto/MapaAssentosDto.java`; `api/src/test/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoMapaRepositoryTest.java`.
- **Back-end (update)**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (novo método `buscarMapaPorSessao()`); `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java` (novo método `mapaAssentos()`, nova constante `STATUS_RESERVADO`); `api/src/main/java/br/com/rolo35/api/sessoes/controller/SessaoController.java` (novo `@GetMapping("/{id}/mapa-assentos")`); `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (novo `permitAll()` específico); `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java`; `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java`; `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java`.
- **Front-end (novo)**: `web/src/pages/MapaAssentosPage.tsx`; `web/src/pages/MapaAssentosPage.test.tsx`.
- **Front-end (update)**: `web/src/api/sessoes.ts` (novo `AssentoMapa`, `MapaAssentos`, `buscarMapaAssentos`); `web/src/pages/FilmeDetalhePage.tsx` (`escolherHorario` navega pra rota real); `web/src/App.tsx` (rota `/sessoes/:id/assentos` nova).
- **Documentação (update)**: `docs/decisions.md`.
- **Leitura obrigatória antes de codar** (arquivos UPDATE, não criar do zero): `api/src/main/java/br/com/rolo35/api/sessoes/AssentoSessao.java`, `.../sessoes/AssentoSessaoId.java`, `.../sessoes/Assento.java`, `.../sessoes/repository/AssentoSessaoRepository.java`, `.../sessoes/repository/SessaoRepository.java` (padrão de query nativa), `.../sessoes/service/SessaoService.java`, `.../sessoes/controller/SessaoController.java`, `.../config/SecurityConfig.java`, `.../common/GlobalExceptionHandler.java`, `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java`, `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java`, `web/src/api/sessoes.ts`, `web/src/api/client.ts` (classe `ApiRequestError`), `web/src/pages/FilmeDetalhePage.tsx`, `web/src/App.tsx` — todos já lidos por completo durante a criação desta story (estado pós Story 2.3), conteúdo atual descrito em Dev Notes acima.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Mapa de Assentos Público]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#§4.4 Busca e Reserva de Assento]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-4 (TTL lazy sem job agendado), AD-1 (pacotes por domínio), AD-11 (envelope de erro), AD-12 (DTO explícito), AD-13 (nomenclatura), Capability → Architecture Map §4.4]
- [Source: CLAUDE.md — Metodologia XP + TDD, Non-negotiables de Modelagem/Qualidade (evitar N+1, sem regra de negócio no controller, estados de carregamento/vazio/erro), Convenções de nomenclatura]
- [Source: _bmad-output/implementation-artifacts/2-3-listagem-publica-de-sessoes.md — padrão de rota pública com `permitAll()` cirúrgico, estados loading/vazio/erro/pronto no front, Dev Notes sobre não inventar campo fora de escopo]
- [Source: api/src/main/resources/db/migration/V1__schema.sql — schema de `assento_sessao` (status/reserva_id/expires_at), `assentos` (fileira/numero), `sessoes`, `salas`]
- [Source: código existente lido por completo nesta criação de story: `br.com.rolo35.api.sessoes.{AssentoSessao,AssentoSessaoId,Assento,Sessao,Sala}`, `sessoes.repository.{AssentoSessaoRepository,AssentoRepository,SessaoRepository}`, `sessoes.service.SessaoService`, `sessoes.controller.SessaoController`, `config.SecurityConfig`, `common.GlobalExceptionHandler`, `web/src/api/{client.ts,sessoes.ts}`, `web/src/pages/{ListagemSessoesPage.tsx,FilmeDetalhePage.tsx}`, `web/src/App.tsx`, `web/src/components/PageShell.tsx`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoMapaProjection.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (update — `buscarMapaPorSessao()`)
- `api/src/test/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoMapaRepositoryTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/AssentoMapaDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/MapaAssentosDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java` (update — `mapaAssentos()`, `STATUS_RESERVADO`)
- `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (update)
- `api/src/main/java/br/com/rolo35/api/sessoes/controller/SessaoController.java` (update — `GET /{id}/mapa-assentos`)
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (update — `permitAll()` específico)
- `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java` (update)
- `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java` (update)
- `web/src/api/sessoes.ts` (update — `AssentoMapa`, `MapaAssentos`, `buscarMapaAssentos`)
- `web/src/pages/MapaAssentosPage.tsx` (novo)
- `web/src/pages/MapaAssentosPage.test.tsx` (novo)
- `web/src/pages/FilmeDetalhePage.tsx` (update — `escolherHorario` navega pra rota real)
- `web/src/App.tsx` (update — rota `/sessoes/:id/assentos`)
