---
baseline_commit: 964c922
---

# Story 2.3: Listagem Pública de Sessões

Status: done

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a visitante (sem login),
I want ver a lista de sessões publicadas, incluindo as esgotadas,
so that eu descubra o que tem em cartaz mesmo sem conta.

## Acceptance Criteria

1. **Given** sessões publicadas existentes, algumas com assentos livres e outras esgotadas **When** `GET` na listagem de sessões é chamado sem autenticação **Then** todas aparecem, cada uma marcada com seu estado (com vaga / esgotada) — sessão esgotada não some da lista.

2. **Given** a listagem **When** ela junta dado de filme e sala pra cada sessão **Then** não há N+1 — uma única consulta (projection/fetch join) traz sessão + filme + sala juntos.

3. **Given** nenhuma sessão publicada no momento **When** a listagem é consultada **Then** o front-end mostra estado de lista vazia, não erro.

4. **Given** a listagem em carregamento **When** a requisição ainda não retornou **Then** o front-end mostra estado de carregamento.

5. **Given** a listagem retorna erro (ex.: back-end indisponível) **When** o front-end recebe a falha **Then** mostra estado de erro distinto do estado de lista vazia.

## Branch e commits — regra obrigatória desta story

Continuar na branch `epic-2-gestao-de-sessoes-organizador` (já existe, criada na Story 2.1 — não criar branch nova). Cada task abaixo termina em **um commit próprio**, só com o que foi feito naquela task, nessa branch. Ciclo por task: **RED** (escrever o teste, rodar, confirmar que falha por ausência do código) → **GREEN** (código mínimo que faz passar, rodar até verde) → **commit**. Mensagem de commit: curta e direta, no padrão Conventional Commits já usado no repo — `tipo(sessoes): descrição curta` (ver `git log` pra exemplos reais: `feat(sessoes): ...`, `test(sessoes): ...`, `fix(sessoes): ...`, `docs(sessoes): ...`). Cada task abaixo já sugere a mensagem — use como base, ajuste se o que foi implementado de fato divergir um pouco. Tasks sem teste próprio (docs) commitam do mesmo jeito, sem par RED/GREEN — só o commit ao final da task.

## TDD — regra obrigatória desta story

> Regra única do projeto (§ Metodologia XP + TDD das instruções do projeto): **todo teste nasce antes do código**, sempre. Cada subtask de código abaixo é precedida da sua subtask de teste, marcada **[RED]**. Ciclo: escrever o teste → rodar e ver falhar por ausência do código (RED) → escrever o código mínimo que faz passar (**[GREEN]**) → refactor se necessário, mantendo os testes verdes. Não pule o RED. A única exceção documentada no projeto é a UI de interação visual (Task 4 abaixo), cujo teste de contrato nasce **depois** do componente pronto (cobertura leve, focada em contrato de comportamento, não em renderização) — todo o resto segue RED→GREEN sem exceção.

## Tasks / Subtasks

- [x] **Task 1 — `SessaoRepository.listarPublicadas()`: uma única query sem N+1 (AC1, AC2)**
  - [x] **[RED]** Escrever `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoListagemRepositoryTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `SalaAssentoRepositorySmokeTest`): popular 2 sessões na Sala 1 (seed, `linhas=5, colunas=8`, capacidade 40) — uma sem nenhum `assento_sessao` marcado `VENDIDO`/`RESERVADO` (todos `LIVRE`, deve vir `esgotada=false`) e outra com **todos** os 40 `assento_sessao` marcados `VENDIDO` (deve vir `esgotada=true`, capacidade continua 40, não 0). Assert de shape: `salaNome`, `capacidade`, `assentosLivres` batendo com o fixture. Rodar e confirmar que falha por `listarPublicadas()`/a projeção ainda não existirem.
  - [x] **[GREEN]** Criar `repository/SessaoListagemProjection.java` (interface Spring Data, getters `Long getId()`, `String getSalaNome()`, `Long getTmdbId()`, `String getTitulo()`, `String getPosterUrl()`, `String getSinopse()`, `java.sql.Date getDataEstreia()`, `LocalDateTime getDataHora()`, `BigDecimal getPreco()`, `int getCapacidade()`, `long getAssentosLivres()`). Adicionar em `SessaoRepository`:
    ```java
    @Query(value = """
        SELECT s.id AS id, sa.nome AS salaNome, s.tmdb_id AS tmdbId, s.titulo AS titulo,
               s.poster_url AS posterUrl, s.sinopse AS sinopse, s.data_estreia AS dataEstreia,
               s.data_hora AS dataHora, s.preco AS preco,
               COUNT(DISTINCT a.id) AS capacidade,
               COUNT(DISTINCT CASE WHEN asx.status = 'LIVRE' THEN asx.assento_id END) AS assentosLivres
        FROM sessoes s
        JOIN salas sa ON sa.id = s.sala_id
        JOIN assentos a ON a.sala_id = s.sala_id
        LEFT JOIN assento_sessao asx ON asx.sessao_id = s.id AND asx.assento_id = a.id
        GROUP BY s.id, sa.nome
        ORDER BY s.data_hora
        """, nativeQuery = true)
    List<SessaoListagemProjection> listarPublicadas();
    ```
    Uma única query nativa (`JOIN` + `LEFT JOIN` + `GROUP BY`) satisfaz a AC2 — capacidade vem de `COUNT(DISTINCT a.id)` (mapa real de assentos, mesmo critério de derivação da Story 2.1), não de `linhas*colunas`. Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): SessaoRepository.listarPublicadas() sem N+1 (AC1-2)`

- [x] **Task 2 — `SessaoService.listarPublicadas()` mapeia pra DTO com `esgotada` (AC1)**
  - [x] **[RED]** Escrever/estender `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (Mockito puro, mocka `SessaoRepository`) cobrindo: projeção com `assentosLivres > 0` → `SessaoListagemDto.esgotada() == false`; projeção com `assentosLivres == 0` → `esgotada() == true`; lista vazia do repository → lista vazia no retorno (não lança exceção). Rodar e confirmar que falha por `listarPublicadas()`/`SessaoListagemDto` ainda não existirem.
  - [x] **[GREEN]** Criar `dto/SessaoListagemDto.java` (record: `id, salaNome, tmdbId, titulo, posterUrl, sinopse, dataEstreia, dataHora, preco, capacidade, esgotada` — sem `assentosLivres` na resposta pública, é detalhe interno de cálculo). Adicionar `SessaoService.listarPublicadas(): List<SessaoListagemDto>` — thin, mapeia cada `SessaoListagemProjection` calculando `esgotada = projecao.getAssentosLivres() == 0`. Rodar o teste até passar.
  - [x] Commit: `feat(sessoes): SessaoService.listarPublicadas() calcula esgotada (AC1)`

- [x] **Task 3 — `GET /api/sessoes` público, sem autenticação (AC1)**
  - [x] **[RED]** Estender `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java` (`@WebMvcTest(SessaoController.class)`, `SessaoService` mockado): `GET /api/sessoes` → `200` + array no shape de `SessaoListagemDto`; service retorna lista vazia → `200` + `[]` (não erro, AC3 é responsabilidade do front, mas o back não pode confundir vazio com falha). Estender `SessaoSecurityTest.java` (filtros de segurança reais ligados, sem `addFilters=false`) com um caso **sem token nenhum** no header → `GET /api/sessoes` chega `200` no service mockado (hoje, sem essa task, cairia em `401`/`403` por causa do `.anyRequest().authenticated()` — é esse RED que prova a lacuna). Rodar e confirmar que falha.
  - [x] **[GREEN]** Adicionar `@GetMapping` em `SessaoController` (sem `@PreAuthorize` — rota pública) delegando pra `sessaoService.listarPublicadas()`. Em `SecurityConfig`, adicionar `.requestMatchers(HttpMethod.GET, "/api/sessoes").permitAll()` **antes** de `.anyRequest().authenticated()` (mesmo lugar do `permitAll()` de `/api/auth/login`). Rodar os testes até passar.
  - [x] Commit: `feat(sessoes): GET /api/sessoes público sem autenticação (AC1)`

- [x] **Task 4 — Tela de listagem pública de sessões (AC1, AC3, AC4, AC5)**
  - [x] Criar `web/src/api/sessoes.ts` (arquivo existente, estender): adicionar `interface SessaoPublicada` (mesmos campos do `SessaoListagemDto`, incluindo `esgotada: boolean`) e `listarSessoesPublicadas(): Promise<SessaoPublicada[]>` (`GET /api/sessoes`) — sem `Authorization`, já que `apiFetch` (`client.ts`) só anexa o header se houver token no `localStorage`, e visitante sem login simplesmente não tem um.
  - [x] Criar `web/src/pages/ListagemSessoesPage.tsx`: no mount, chama `listarSessoesPublicadas()` com máquina de estado `loading/vazio/erro/pronto` (mesmo padrão de `CriarSessaoPage`/`BuscaFilmesPage` — `role="alert"` no erro). Estado `vazio` quando a resposta é `[]` (AC3), distinto de `erro` quando a promise rejeita (AC5). Cada sessão renderiza pôster, título, sala, data/hora, preço, e um badge "Esgotada" quando `esgotada === true` — a sessão continua na lista de qualquer forma (AC1, não filtra nem esconde). Usa só os tokens Tailwind já definidos no projeto (`bg-sepia-950`, `font-display`, `text-amber-300`, `border-gold-500`, etc.) — sem cor nova.
  - [x] Trocar em `web/src/App.tsx`: `<Route path="/cliente" element={<PapelPlaceholderPage titulo="Área do Cliente" />} />` vira `<Route path="/cliente" element={<ListagemSessoesPage />} />` — é a rota pra onde o login de `CLIENTE` já navega (`LoginPage.tsx: rotaPorPapel`), e FR-8 é justamente "cliente lista/busca sessões publicadas". `PapelPlaceholderPage` continua em uso nas rotas `/portaria` (sem mudança).
  - [x] Depois do componente pronto: `ListagemSessoesPage.test.tsx` (vitest + testing-library) — mocka `api/sessoes.ts`, cobre estados `loading/vazio/erro/pronto`, badge "Esgotada" aparecendo só nas sessões com `esgotada === true` e sessão esgotada continuando visível na lista.
  - [x] Commit: `feat(sessoes): tela de listagem pública de sessões (AC1, AC3-5)`

- [x] **Task 5 — Confirmação final (sem código novo, checklist de saída)**
  - [x] Rodar a suíte completa (back-end `mvn test`, incluindo o teste Testcontainers da Task 1; front-end `npm test`, `npm run build`, `npm run lint`) e confirmar tudo verde.
  - [x] Registrar em `docs/decisions.md`: ausência de coluna `publicada`/estado de rascunho em `sessoes` (toda sessão criada já é listável — decisão implícita desta story, não da 2.1) e a query única de `listarPublicadas()` (por que `JOIN`+`GROUP BY` em vez de duas consultas).
  - [x] Atualizar o Status desta story pra `review` (mesmo ciclo já usado nas Stories 1.1/1.2/2.1: code-review antes de `done`).
  - [x] Commit: `docs(sessoes): confirmação final e fecha Story 2.3 pra review`

### Review Findings

- [x] [Review][Decision→Patch] Sessões passadas continuam aparecendo pra sempre na listagem pública — `listarPublicadas()` não tinha `WHERE data_hora >= now()` nem qualquer filtro temporal. Corrigido: filtro adicionado na própria query nativa, coberto por `SessaoListagemRepositoryTest.listarPublicadasNaoTrazSessaoComDataHoraNoPassado` (RED→GREEN), commit `fix(sessoes): esconde sessões passadas da listagem pública (code review)`. [api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java:23-37]
- [x] [Review][Patch] `SecurityConfig` encadeia dois `.requestMatchers(...).permitAll()` separados — avaliado e mantido como está: é o padrão idiomático do Spring Security pra um grupo por path (login/health) e outro por método+path (GET de sessões), não um descuido de estilo. Adicionado comentário explícito no código deixando essa intenção clara, commit `refactor(sessoes): documenta os dois grupos de permitAll em SecurityConfig (code review)`. [api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java:40-51]
- [x] [Review][Defer] `listarPublicadas()` usa `JOIN assentos` (INNER) — uma sessão cuja sala não tivesse nenhum assento cadastrado desapareceria da listagem, o que violaria literalmente o AC1 ("todas aparecem"). Hoje é inalcançável: `SessaoService.criar()` já rejeita com `SalaSemAssentosException` a criação de sessão pra sala sem assentos, então toda sessão existente sempre tem sala com assentos. Risco fica latente pra quando existir edição/remoção de assentos de uma sala já com sessões — deferido, pré-existente na modelagem, não causado por esta story. [api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java:31]
- [x] [Review][Defer] `LEFT JOIN assento_sessao` sem tratamento pra assento sem linha correspondente pra aquela sessão — nesse caso ele não conta nem como livre nem como vendido, podendo subcontar `assentosLivres` e marcar `esgotada=true` indevidamente. Hoje inalcançável: `SessaoService.criar()` sempre popula `assento_sessao` pra 100% dos assentos da sala no momento da criação da sessão — nenhum caminho de código atual adiciona assento a uma sala depois. Mesmo risco latente do finding anterior, mesma causa raiz — deferido junto. [api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java:28,32]

## Dev Notes

- **Não existe coluna `publicada`/estado de rascunho em `sessoes`.** `V1__schema.sql` não tem esse campo — toda sessão criada pela Story 2.1 já é, por definição, "publicada". `listarPublicadas()` lista **todas** as sessões da tabela, sem filtro de status. Não inventar uma coluna ou flag nova pra isso — não é pedido por nenhuma AC desta story, e mudar o schema aqui é escopo fora do que foi solicitado.

- **Capacidade sempre do mapa real de assentos, nunca de `sala.linhas * sala.colunas`.** Mesmo critério fixado na Story 2.1 (AC1 de lá): a query desta story deriva `capacidade` de `COUNT(DISTINCT a.id)` sobre `assentos`, não do retângulo declarado em `salas`. As duas fontes podem divergir.

- **`esgotada` é `assentosLivres == 0`, calculado no service, não persistido nem hardcoded na query como booleano.** A query devolve a contagem crua (`assentosLivres`); o `SessaoListagemDto` público expõe só o booleano derivado — não vaza a contagem, que não tem valor pro visitante e abriria margem pra estimar quantos ingressos já foram vendidos.

- **Uma única consulta via `JOIN` + `LEFT JOIN` + `GROUP BY`, não duas consultas separadas.** A AC2 exige "uma única consulta (projection/fetch join)" — o padrão já usado no projeto pra query nativa complexa é `SessaoRepository.existeConflitante` (Story 2.1); esta story segue o mesmo estilo (`@Query(nativeQuery = true)`, aritmética/agregação no SQL, não em Java) em vez de um fetch join JPQL, porque a agregação por `CASE WHEN` + `COUNT DISTINCT` não é natural em JPQL sem subquery correlacionada (que reintroduziria o risco de N+1 dependendo de como o Hibernate a traduz).

- **`GET /api/sessoes` é a primeira rota genuinamente pública da API (além de `/api/auth/login`).** Toda rota anterior cai em `.anyRequest().authenticated()` por padrão; autorização por papel usa `@PreAuthorize` no método (decisão de code review da Story 2.1, ver Dev Notes/Review Findings de lá). Rota pública de leitura precisa do `permitAll()` explícito no `SecurityConfig` — sem isso, visitante sem token recebe `401`/`403` em vez da lista, quebrando a AC central desta story. `SessaoSecurityTest` (Task 3) precisa cobrir explicitamente o caso "sem token" pra não regressar silenciosamente numa story futura.

- **`/cliente` deixa de ser placeholder.** Era só `<PapelPlaceholderPage titulo="Área do Cliente" />` desde a Story 1.1 — vira a listagem real. Continua sem guarda de rota (deferred da Story 2.1, item "Nenhuma guarda de rota no front" — não é escopo desta story mexer nisso, e não precisa: a AC pede explicitamente que funcione **sem** login).

- **Sem exceção nova no back-end.** Lista vazia é `200` + `[]` — não é erro (AC3 é tratamento de front, não de back). Falha de infraestrutura (banco fora, etc.) já cai no `@ExceptionHandler(Exception.class)` genérico existente (`500 ERRO_INTERNO`) — o front trata qualquer falha de `apiFetch` (rejeição da promise) como estado `erro` (AC5), sem precisar de um código de erro específico pra essa tela.

- **Ordenação por `data_hora` ascendente.** Sessões mais próximas primeiro — não é uma AC explícita, mas é o único critério que faz sentido pra "descobrir o que tem em cartaz" sem introduzir paginação ou filtro (fora de escopo, nenhuma AC pede).

- **Sem paginação, filtro ou busca por título nesta story.** FR-8/AC1-5 cobrem só listar e marcar esgotada. Busca/filtro de sessão pública não é pedido aqui — não implementar antecipando Epic 3.

- **Filtro `WHERE s.data_hora >= now()` adicionado após o code review.** Nenhuma AC original pedia isso, mas sem o filtro `listarPublicadas()` acumula pra sempre toda sessão já ocorrida — "Sessões em cartaz" misturaria filmes de meses atrás com os futuros, indefinidamente. Decisão do code review, aplicada como patch: filtro temporal na própria query nativa, coberto por `SessaoListagemRepositoryTest.listarPublicadasNaoTrazSessaoComDataHoraNoPassado`.

## Project Structure Notes

- Segue a estrutura já fixada na Architecture Spine (mesma usada pela Story 2.1), sem desvio novo.
- **Back-end (novo)**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoListagemProjection.java`; `api/src/main/java/br/com/rolo35/api/sessoes/dto/SessaoListagemDto.java`; `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoListagemRepositoryTest.java`.
- **Back-end (update)**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java` (novo método `listarPublicadas()`); `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java` (novo método); `api/src/main/java/br/com/rolo35/api/sessoes/controller/SessaoController.java` (novo `@GetMapping`); `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (`permitAll()` em `GET /api/sessoes`); `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java`; `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java`; `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java`.
- **Front-end (novo)**: `web/src/pages/ListagemSessoesPage.tsx`; `web/src/pages/ListagemSessoesPage.test.tsx`.
- **Front-end (update)**: `web/src/api/sessoes.ts` (novo `SessaoPublicada` + `listarSessoesPublicadas`); `web/src/App.tsx` (rota `/cliente` trocada).
- **Documentação (update)**: `docs/decisions.md`.
- **Leitura obrigatória antes de codar** (arquivos UPDATE, não criar do zero): `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java`, `.../sessoes/service/SessaoService.java`, `.../sessoes/controller/SessaoController.java`, `.../config/SecurityConfig.java`, `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java`, `web/src/api/sessoes.ts`, `web/src/App.tsx` — todos já lidos por completo durante a criação desta story (estado pós Story 2.1), conteúdo atual descrito em Dev Notes acima.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Listagem Pública de Sessões]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#FR-8, §4.4 Busca e Reserva de Assento]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-1, AD-11, AD-12, AD-13, Capability → Architecture Map §4.4, non-negotiable de N+1 das instruções do projeto]
- [Source: instruções do projeto — Metodologia XP + TDD, evitar N+1 nas listagens, índices nas colunas de filtro/join, estados de carregando/lista vazia/erro, Convenções de nomenclatura]
- [Source: _bmad-output/implementation-artifacts/2-1-criacao-de-sessao-com-bloqueio-de-conflito-de-horario.md — padrões de query nativa (`existeConflitante`), estrutura de commit por task, `SecurityConfig`/`@PreAuthorize`, Dev Notes sobre capacidade derivada do mapa real, item deferido "sem guarda de rota no front"]
- [Source: api/src/main/resources/db/migration/V1__schema.sql — schema de `sessoes`, `salas`, `assentos`, `assento_sessao`, sem coluna de status de publicação]
- [Source: código existente lido por completo nesta criação de story: `br.com.rolo35.api.sessoes.{Sessao,Sala,AssentoSessao}`, `sessoes.repository.SessaoRepository`, `sessoes.service.SessaoService`, `sessoes.controller.SessaoController`, `sessoes.dto.SessaoResponse`, `config.SecurityConfig`, `common.GlobalExceptionHandler`, `web/src/api/{client.ts,sessoes.ts}`, `web/src/pages/{BuscaFilmesPage.tsx,CriarSessaoPage.tsx,PapelPlaceholderPage.tsx,LoginPage.tsx}`, `web/src/App.tsx`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-agent-dev / Amelia)

### Debug Log References

- Task 1 RED: `SessaoListagemRepositoryTest` inicialmente falhou com `DataIntegrityViolationException` (chave duplicada em `assento_sessao`) ao tentar marcar assentos como `VENDIDO` construindo novas instâncias de `AssentoSessao` — `Persistable.isNew()` (Story 2.1) tratava as novas instâncias como inserts. Corrigido mutando os assentos já carregados via `ReflectionTestUtils.setField` antes do `saveAll`.
- Task 2 RED: `SessaoServiceTest` falhou com `UnfinishedStubbingException` — a chamada a `projecaoCom(...)` (que já contém `given().willReturn()` internos) estava sendo passada direto como argumento de outro `given(...).willReturn(...)`, interleaving o estado de stubbing do Mockito. Corrigido extraindo a projeção pra uma variável local antes do `given()` externo.

### Completion Notes List

- Story implementada de ponta a ponta seguindo o ciclo RED → GREEN → commit por task, sem pular etapas. Suíte completa (back `mvn test`, front `npm test`/`npm run build`/`npm run lint`) verde ao final da Task 5.
- Nenhuma divergência entre o snapshot de código descrito nas Dev Notes (momento da criação da story) e o estado real do repositório no início do dev — todas as tasks foram implementadas exatamente como especificado.

### File List

- `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoListagemProjection.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java` (update)
- `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoListagemRepositoryTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/SessaoListagemDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java` (update)
- `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (update)
- `api/src/main/java/br/com/rolo35/api/sessoes/controller/SessaoController.java` (update)
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (update)
- `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java` (update)
- `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java` (update)
- `web/src/api/sessoes.ts` (update)
- `web/src/pages/ListagemSessoesPage.tsx` (novo)
- `web/src/pages/ListagemSessoesPage.test.tsx` (novo)
- `web/src/App.tsx` (update)
- `docs/decisions.md` (update)
