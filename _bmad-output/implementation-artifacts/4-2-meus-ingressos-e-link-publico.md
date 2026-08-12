---
baseline_commit: e255202
---

# Story 4.2: Meus Ingressos e Link Público

Status: review

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a cliente autenticado,
I want ver todos os meus ingressos e compartilhar um link público de leitura pra cada um,
so that eu tenho comprovante de compra e posso mostrar o ingresso sem precisar logar de novo.

## Acceptance Criteria

1. **Given** um cliente autenticado com ingressos emitidos (de uma ou mais reservas confirmadas) **When** ele consulta `GET /api/ingressos/minhas` **Then** recebe só os ingressos vinculados à própria conta — nunca de outro cliente — cada item com contexto suficiente pra tela (filme, sala, data/hora da sessão, assento, status, código pra montar o link de compartilhamento).
2. **Given** um cliente autenticado sem nenhum ingresso emitido ainda **When** `GET /api/ingressos/minhas` é consultado **Then** retorna lista vazia (`200 []`), e o front-end mostra estado de lista vazia, não erro.
3. **Given** um código de ingresso válido (assinatura HMAC bate, Story 4.1) **When** o link público é acessado sem token (`GET /api/ingressos/{codigo}`) **Then** retorna `200` com só filme, sessão (sala/data/hora) e o estado do próprio ingresso (`VALIDO`/`UTILIZADO`) — nenhum dado do cliente (`clienteId`, nome, e-mail), nenhum dado de outros ingressos da mesma reserva, sem exigir autenticação, sem expiração (rota nunca expira, ao contrário do hold de 10 min de reservas) e sem lock de banco (AD-9).
4. **Given** o link público de um ingresso **When** acessado (uma ou múltiplas vezes) **Then** o estado do ingresso nunca muda como efeito colateral da leitura — `status`/`validatedAt` continuam exatamente como estavam antes do acesso; a rota não interfere no fluxo de validação da portaria (Story 5.2, que é a única que transiciona `VALIDO → UTILIZADO`, AD-9).
5. **Given** um código de ingresso inexistente (UUID não bate com nenhuma linha) **ou** com assinatura HMAC inválida (adulterado) **When** o link público é acessado **Then** retorna `404 {codigo: "INGRESSO_NAO_ENCONTRADO"}` nos dois casos, com a **mesma** resposta — não é possível diferenciar "não existe" de "assinatura errada" pela resposta (evita usar a API como oráculo de enumeração de UUIDs válidos).

## Tasks / Subtasks

- [x] **Task 1 — `IngressoRepository`: leitura por cliente e por id, sem mutação (AC1, AC3)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/repository/IngressoLeituraRepositoryTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `IngressoRepositorySmokeTest` da Story 4.1): popular 2 clientes, 2 reservas (uma por cliente), ingressos pra cada uma; `buscarPorCliente(clienteId)` retorna só os ingressos da reserva daquele cliente, com `titulo`/`salaNome`/`dataHora`/`fileira`/`numero` do assento já resolvidos (projection, sem N+1 — mesmo critério non-negotiable das stories anteriores); `findById(codigoUuid)` (herdado de `JpaRepository`, já existe da Story 4.1) usado pro link público, sem lock nenhum (nenhum `@Lock` na query de leitura pública — AC4/AD-9 exigem isso explicitamente). Rodar e confirmar que falha por `buscarPorCliente()`/projection ainda não existirem.
  - [x] **[GREEN]** Criar `ingressos/repository/IngressoResumoProjection.java` (interface Spring Data: `getId(): UUID`, `getStatus(): String`, `getAssentoFileira(): String`, `getAssentoNumero(): Integer`, `getSessaoTitulo(): String`, `getSessaoPosterUrl(): String`, `getSalaNome(): String`, `getDataHora(): LocalDateTime`). Adicionar em `IngressoRepository`:
    ```java
    @Query("""
        SELECT i.id AS id, i.status AS status,
               a.fileira AS assentoFileira, a.numero AS assentoNumero,
               s.titulo AS sessaoTitulo, s.posterUrl AS sessaoPosterUrl, sa.nome AS salaNome, s.dataHora AS dataHora
        FROM Ingresso i
        JOIN Reserva r ON r.id = i.reservaId
        JOIN Assento a ON a.id = i.assentoId
        JOIN Sessao s ON s.id = i.sessaoId
        JOIN Sala sa ON sa.id = s.salaId
        WHERE r.clienteId = :clienteId
        ORDER BY s.dataHora DESC
        """)
    List<IngressoResumoProjection> buscarPorCliente(Long clienteId);
    ```
    Mesmo padrão de `JOIN ... ON` explícito já usado em `AssentoSessaoRepository.buscarMapaPorSessao()` (Story 3.1) pra navegar entre entidades sem associação `@ManyToOne` mapeada (`Ingresso` guarda só os IDs soltos `reservaId`/`assentoId`/`sessaoId`, mesmo estilo de `AssentoSessao`/`AssentoSessaoId` — decisão consistente, não single-purpose desta query). `findById(UUID)` da leitura pública já vem de `JpaRepository`, sem necessidade de método novo — só usar sem `@Lock` (ao contrário de todo outro `findByIdForUpdate` do projeto, é deliberado: AD-9 exige "sem lock" pra rota pública). Rodar o teste até passar.
  - [x] Commit: `feat(ingressos): IngressoRepository.buscarPorCliente() sem N+1 (AC1, AC3)`

- [x] **Task 2 — `IngressoService`: `listarMinhas()` e `buscarPublico()` com validação HMAC antes do banco (AC1-5)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/service/IngressoServiceTest.java` (Mockito puro, mocka `IngressoRepository`, `UsuarioRepository`, `CodigoIngressoService`): (a) `listarMinhas(clienteEmail)` → resolve `Usuario` por e-mail, chama `buscarPorCliente(usuario.getId())`, mapeia pra `List<IngressoResumoDto>`; cliente sem ingresso → lista vazia (não exceção, AC2); (b) `buscarPublico(codigo)` com `codigo` cuja assinatura HMAC não bate (mock de `CodigoIngressoService.validar()` retornando `false`) → `IngressoNaoEncontradoException`, **sem nenhuma chamada** a `ingressoRepository.findById()` (prova de AC5: a assinatura é checada antes do banco); (c) assinatura válida mas `findById()` não encontra a linha → mesma `IngressoNaoEncontradoException` (mesma exceção dos dois casos — prova de que a resposta não diferencia os motivos, AC5); (d) assinatura válida + linha encontrada → `IngressoPublicoDto` com `titulo/salaNome/dataHora/status`, sem `clienteId`/`reservaId`/outros campos internos. Rodar e confirmar que falha.
  - [x] **[GREEN]** Criar `ingressos/dto/IngressoResumoDto.java` (record: `id: UUID, status: StatusIngresso, assentoFileira: String, assentoNumero: Integer, sessaoTitulo: String, sessaoPosterUrl: String, salaNome: String, dataHora: LocalDateTime, codigo: String` — `codigo` é recomputado via `CodigoIngressoService.gerar(id)` no momento da montagem do DTO, não persistido, mesmo racional de "sem coluna própria de código" de AD-8; front usa esse campo pra montar o link `/ingressos/{codigo}` a compartilhar). Criar `ingressos/dto/IngressoPublicoDto.java` (record: `sessaoTitulo, salaNome, dataHora, status` — deliberadamente **sem** `id`/`assento`/`codigo`/qualquer coisa que identifique o cliente ou outros ingressos da mesma reserva, AC3). Criar `ingressos/IngressoNaoEncontradoException.java`. Criar `ingressos/service/IngressoService.java`:
    ```java
    public List<IngressoResumoDto> listarMinhas(String clienteEmail) {
        Usuario cliente = usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);
        return ingressoRepository.buscarPorCliente(cliente.getId()).stream()
                .map(p -> new IngressoResumoDto(p.getId(), StatusIngresso.valueOf(p.getStatus()), p.getAssentoFileira(),
                        p.getAssentoNumero(), p.getSessaoTitulo(), p.getSessaoPosterUrl(), p.getSalaNome(), p.getDataHora(),
                        codigoIngressoService.gerar(p.getId())))
                .toList();
    }

    public IngressoPublicoDto buscarPublico(String codigo) {
        UUID id = extrairId(codigo); // parse da 1ª parte antes do "." — 400/404 se malformado, ver Dev Notes
        if (!codigoIngressoService.validar(id, codigo)) {
            throw new IngressoNaoEncontradoException(); // assinatura inválida: nunca toca o banco (AC5)
        }
        Ingresso ingresso = ingressoRepository.findById(id).orElseThrow(IngressoNaoEncontradoException::new);
        Sessao sessao = sessaoRepository.findById(ingresso.getSessaoId()).orElseThrow(SessaoNaoEncontradaException::new);
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        return new IngressoPublicoDto(sessao.getTitulo(), sala.getNome(), sessao.getDataHora(), ingresso.getStatus());
    }
    ```
    **`extrairId(codigo)` reaproveita o mesmo parsing que `CodigoIngressoService.validar()` já faz internamente** (Story 4.1: `codigo.split("\\.", 2)`, primeira parte é o `uuid`) — expor um método `CodigoIngressoService.extrairId(String): Optional<UUID>` em vez de duplicar o parsing aqui é a opção mais limpa; ajustar a Task 1 da Story 4.1 nesse sentido é aceitável (mudança aditiva, não quebra nada já especificado lá) ou, se a 4.1 já estiver implementada de outro jeito quando esta story rodar, adaptar pro que existir de fato. `sessaoRepository`/`salaRepository` são os mesmos beans de `sessoes.repository`, reaproveitados (não duplicar consulta de sessão/sala — já existem desde a Story 3.1). Rodar o teste até passar.
  - [x] Commit: `feat(ingressos): IngressoService.listarMinhas()/buscarPublico() (AC1-5)`

- [x] **Task 3 — Rotas: `GET /api/ingressos/minhas` (autenticada) e `GET /api/ingressos/{codigo}` (pública) (AC1-5)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/controller/IngressoControllerTest.java` (`@WebMvcTest`, service mockado): `GET /api/ingressos/minhas` com token `CLIENTE` → `200` + array de `IngressoResumoDto`; `GET /api/ingressos/{codigo}` sem token → `200` + shape de `IngressoPublicoDto` (sem `clienteId`/`id`/`codigo` no corpo — assert negativo desses campos, não só positivo dos que devem aparecer); service lança `IngressoNaoEncontradoException` → `404 INGRESSO_NAO_ENCONTRADO`. Estender `IngressoSecurityTest.java` (mesmo padrão de `SessaoSecurityTest`/`ReservaSecurityTest`): `GET /api/ingressos/minhas` sem token → `403`; `GET /api/ingressos/{codigo}` sem token nenhum → passa pro service mockado, prova a lacuna de autenticação de propósito (mesmo padrão do teste equivalente das Stories 2.3/3.1). Rodar e confirmar que falha.
  - [x] **[GREEN]** Criar `ingressos/controller/IngressoController.java`:
    ```java
    @RestController
    @RequestMapping("/api/ingressos")
    public class IngressoController {
        @GetMapping("/minhas")
        @PreAuthorize("hasRole('CLIENTE')")
        public ResponseEntity<List<IngressoResumoDto>> minhas(Authentication authentication) {
            return ResponseEntity.ok(ingressoService.listarMinhas(authentication.getName()));
        }

        @GetMapping("/{codigo}")
        public ResponseEntity<IngressoPublicoDto> buscarPublico(@PathVariable String codigo) {
            return ResponseEntity.ok(ingressoService.buscarPublico(codigo));
        }
    }
    ```
    Em `SecurityConfig`, adicionar **outra** entrada específica ao grupo de `permitAll()` já existente: `.requestMatchers(HttpMethod.GET, "/api/ingressos/*").permitAll()` — casa só `/api/ingressos/{codigo}` (um segmento), **não** `/api/ingressos/minhas`... **atenção**: `/minhas` também é um segmento único, então esse matcher bateria nos dois paths igualmente e vazaria `/minhas` como pública, replicando o erro que a Story 3.1 evitou de propósito com `/mapa-assentos`. **Ordem dos `requestMatchers` importa aqui**: declarar `.requestMatchers(HttpMethod.GET, "/api/ingressos/minhas").authenticated()` **antes** do `permitAll()` de `/api/ingressos/*` não resolve sozinho (Spring Security avalia na ordem declarada e para no primeiro match, então **inverter a ordem** — `minhas` autenticado primeiro, `*` público depois — é a correção correta; testar via `IngressoSecurityTest` que `/minhas` sem token realmente cai em `403`, não em `200` do service mockado). Rodar os testes até passar, prestando atenção nesse caso específico.
  - [x] Commit: `feat(ingressos): GET /api/ingressos/minhas e /{codigo} (AC1-5)`

- [x] **Task 4 — Front-end: "Meus Ingressos" e página pública do link (AC1-5)**
  - [x] **⚠️ Pré-requisito não satisfeito no momento da criação desta story**: `Ingresso`/`IngressoRepository`/`CodigoIngressoService`/rotas de `pagamentos` (Story 4.1) só existem como spec, não como código. Não iniciar esta task (nem as Tasks 1-3 desta story, na verdade) antes da Story 4.1 estar implementada e commitada — o `IngressoResumoDto`/`IngressoPublicoDto` desta story dependem de `Ingresso` já existir com os campos exatos que a 4.1 definiu.
  - [x] Criar `web/src/api/ingressos.ts` (novo módulo por domínio, AD-2): `interface IngressoResumo { id: string; status: 'VALIDO' | 'UTILIZADO'; assentoFileira: string; assentoNumero: number; sessaoTitulo: string; sessaoPosterUrl: string | null; salaNome: string; dataHora: string; codigo: string }`, `interface IngressoPublico { sessaoTitulo: string; salaNome: string; dataHora: string; status: 'VALIDO' | 'UTILIZADO' }`, `listarMeusIngressos(): Promise<IngressoResumo[]>` (`GET /api/ingressos/minhas`, precisa de `Authorization`), `buscarIngressoPublico(codigo: string): Promise<IngressoPublico>` (`GET /api/ingressos/${codigo}`, sem `Authorization` — mesmo raciocínio de `buscarMapaAssentos` da Story 3.1: `apiFetch` só anexa o header se houver token).
  - [x] Criar `web/src/pages/MeusIngressosPage.tsx`: no mount chama `listarMeusIngressos()`, máquina de estado `loading/erro/vazio/pronto` (AC2 — lista vazia é estado próprio, não erro, mesmo padrão de `ListagemSessoesPage`). Cada ingresso mostra pôster/título/sala/data/assento/status, com um link/botão "compartilhar" que monta a URL pública (`${window.location.origin}/ingressos/${ingresso.codigo}`) — copiar pra clipboard ou exibir a URL, sem inventar mecanismo de compartilhamento nativo (`navigator.share`) fora de escopo.
  - [x] Criar `web/src/pages/IngressoPublicoPage.tsx`: lê `codigo` da URL via `useParams`, chama `buscarIngressoPublico(codigo)`, mesma máquina de estado `loading/nao-encontrado/erro/pronto` (404 → `nao-encontrado`, resto → `erro`, mesmo padrão de `MapaAssentosPage` da Story 3.1). Renderiza só filme/sala/data-hora/status — sem nenhum controle de ação (não é a tela de validação da portaria, é só exibição, AC4).
  - [x] Em `web/src/App.tsx`: adicionar `<Route path="/meus-ingressos" element={<MeusIngressosPage />} />` e `<Route path="/ingressos/:codigo" element={<IngressoPublicoPage />} />` dentro do `<Route element={<Layout />}>` (mesmo padrão de `MapaAssentosPage`, pública mas dentro do Layout comum — não isolada como `/login`).
  - [x] Depois dos componentes prontos: `MeusIngressosPage.test.tsx` e `IngressoPublicoPage.test.tsx` (vitest + testing-library) — cobrem os estados de cada máquina (contrato de comportamento, não pixel/CSS, mesmo critério de todas as stories anteriores).
  - [x] Commit: `feat(ingressos): telas de Meus Ingressos e link público (AC1-5)`

- [x] **Task 5 — Confirmação final (sem código novo, checklist de saída)**
  - [x] Rodar a suíte completa (back-end `mvn test`; front-end `npm test`, `npm run build`, `npm run lint`) e confirmar tudo verde. Se a Task 4 ainda estiver bloqueada (Story 4.1 sem implementação), registrar isso nos Dev Agent Record e rodar só o que existe (backend).
  - [x] Registrar em `docs/decisions.md`: (a) por que a ordem dos `requestMatchers` em `SecurityConfig` importa pra não vazar `/api/ingressos/minhas` como pública (armadilha real encontrada na Task 3 — vale o registro pra não repetir em rotas futuras com o mesmo padrão `/recurso/{param}` + `/recurso/acao-fixa`); (b) por que `buscarPublico()` valida a assinatura HMAC antes de qualquer consulta ao banco (AC5, timing/oracle); (c) notação de rota: PRD usa `/ingressos/{codigo}` como abreviação, implementação usa `/api/ingressos/{codigo}` por consistência com o prefixo já estabelecido em todo o resto da API.
  - [x] Atualizar o Status desta story pra `review`.
  - [x] Commit: `docs(ingressos): confirmação final e fecha Story 4.2 pra review — encerra Epic 4`

## Dev Notes

- **Dependência viva com a Story 4.1, ainda não implementada em código no momento em que esta spec foi criada.** `Ingresso`, `StatusIngresso`, `IngressoRepository` (com `findById` herdado), `CodigoIngressoService.validar()`/`.gerar()` existem só como especificação em `4-1-confirmacao-de-pagamento-simulado-com-emissao-de-ingresso.md`. Esta story usa exatamente os nomes de campo que a 4.1 definiu (`reservaId`, `assentoId`, `sessaoId`, `status`, `validatedAt`, `createdAt` em `Ingresso`; `id, assentoId, codigo` no `IngressoDto` interno da 4.1, distinto do `IngressoResumoDto`/`IngressoPublicoDto` desta story). **Não iniciar `dev-story` desta story antes da 4.1 estar implementada e commitada** — se a implementação real da 4.1 divergir da spec (nomes de campo, assinatura de `CodigoIngressoService`), ajustar esta story primeiro.

- **Armadilha real de `SecurityConfig`: `/api/ingressos/{codigo}` e `/api/ingressos/minhas` têm a mesma forma de path (`/api/ingressos/<um-segmento>`).** Um matcher `permitAll()` em `/api/ingressos/*` bate nos dois. A Story 3.1 evitou esse problema porque `/mapa-assentos` é um segmento **a mais** depois do `{id}` (`/api/sessoes/{id}/mapa-assentos`), não colidindo com `/api/sessoes/{id}` puro. Aqui não tem esse luxo — `minhas` e `{codigo}` ocupam a mesma posição de path. A correção (Task 3) é de **ordem de declaração**: Spring Security avalia `requestMatchers` na ordem em que aparecem e usa o primeiro que casar, então declarar o matcher específico e autenticado (`/minhas`) **antes** do matcher genérico público (`/*`) garante que `/minhas` nunca cai no `permitAll()` mais amplo. Testar isso explicitamente (`IngressoSecurityTest`) não é opcional aqui — é o caso mais fácil de acertar por acidente na ordem errada e não perceber até um code review ou, pior, em produção.

- **`buscarPublico()` não revela por que um código falhou.** AC5 exige a mesma resposta (`404 INGRESSO_NAO_ENCONTRADO`) tanto pra "UUID não existe" quanto "assinatura inválida" — isso já é uma continuação direta do desenho de AD-8 (a validação de assinatura acontece antes de qualquer consulta), só que agora também precisa ser verdade na camada de resposta HTTP, não só na ordem de execução interna. Não adicionar um código de erro mais específico tipo `ASSINATURA_INVALIDA` — vazaria a mesma informação que a rota foi desenhada pra não vazar.

- **Rota pública nunca adquire lock nem escreve — reforço explícito de AD-9.** Ao contrário de toda outra leitura autenticada do projeto que eventualmente evolui pra escrita (ex.: `SessaoService.mapaAssentos()` é hoje só leitura mas convive no mesmo service que `criar()`/`editar()`, que travam), o método `buscarPublico()` desta story não deve ganhar nenhum parâmetro ou branch de escrita no futuro — validação de portaria (Story 5.2) é deliberadamente uma rota e um método de service **totalmente separados**, nunca uma extensão deste. Isso não é otimização prematura, é o non-negotiable de segurança do CLAUDE.md ("link de compartilhamento não permite bypass da validação de portaria").

- **`codigo` no `IngressoResumoDto` é recomputado, não persistido** — mesma decisão de AD-8 já usada na Story 4.1 (o código nunca vira uma coluna própria). Cada chamada a `listarMinhas()` recomputa o HMAC pra cada ingresso; é uma operação puramente de CPU (sem I/O), custo desprezível mesmo pra uma lista razoável de ingressos por cliente.

- **`IngressoResumoProjection`/`buscarPorCliente()` traz dado de 4 tabelas numa query só (`ingressos`, `reservas`, `assentos`, `sessoes`, `salas`)** — mesmo critério non-negotiable de evitar N+1 já seguido em `buscarMapaPorSessao()` (Story 3.1) e `listarPublicadas()` (Story 2.3): a tela "Meus Ingressos" precisa desse contexto todo por item da lista, buscar cada peça separadamente por ingresso seria N+1 clássico.

### Project Structure Notes

- Fecha a Epic 4 — nenhum pacote novo, só estende `ingressos/` (já nascido na Story 4.1).
- **Back-end (novo)**: `api/src/main/java/br/com/rolo35/api/ingressos/repository/IngressoResumoProjection.java`; `.../ingressos/dto/IngressoResumoDto.java`; `.../ingressos/dto/IngressoPublicoDto.java`; `.../ingressos/IngressoNaoEncontradoException.java`; `.../ingressos/service/IngressoService.java`; `.../ingressos/controller/IngressoController.java`; testes correspondentes em `api/src/test/java/br/com/rolo35/api/ingressos/**`.
- **Back-end (update)**: `.../ingressos/repository/IngressoRepository.java` (novo `buscarPorCliente()`); `.../ingressos/service/CodigoIngressoService.java` (Story 4.1 — possível novo método `extrairId(String)`, ver Task 2); `.../config/SecurityConfig.java` (`permitAll()` de `/api/ingressos/*`, **ordem antes** de `/minhas` autenticado); `.../common/GlobalExceptionHandler.java` (handler de `IngressoNaoEncontradoException`).
- **Front-end (novo)**: `web/src/api/ingressos.ts`; `web/src/pages/MeusIngressosPage.tsx` + `.test.tsx`; `web/src/pages/IngressoPublicoPage.tsx` + `.test.tsx`.
- **Front-end (update)**: `web/src/App.tsx` (rotas `/meus-ingressos`, `/ingressos/:codigo`).
- **Documentação (update)**: `docs/decisions.md`.
- **Leitura obrigatória antes de codar**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (padrão `JOIN ... ON` sem associação mapeada), `.../config/SecurityConfig.java` (ordem atual dos `permitAll()`, entender exatamente onde inserir), `.../common/GlobalExceptionHandler.java`, `web/src/api/sessoes.ts`, `web/src/pages/MapaAssentosPage.tsx` (quando existir — padrão de tela pública com estados), `_bmad-output/implementation-artifacts/4-1-confirmacao-de-pagamento-simulado-com-emissao-de-ingresso.md` (nomes de campo exatos de `Ingresso`, **checar contra a implementação real assim que existir**), `_bmad-output/implementation-artifacts/3-1-mapa-de-assentos-publico.md` (precedente direto de rota pública + tela pública).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Meus Ingressos e Link Público]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#§4.6 Emissão e Consulta de Ingresso — FR-15; §4.7 Compartilhamento Público do Ingresso — FR-16]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-8 (assinatura HMAC, recomputada antes do banco), AD-9 (separação leitura pública / validação portaria, sem lock, nunca muda estado), AD-12 (DTO explícito), Capability → Architecture Map §4.6-§4.7]
- [Source: CLAUDE.md — Non-negotiable "link de compartilhamento somente leitura, sem bypass de portaria", Metodologia XP + TDD, evitar N+1]
- [Source: _bmad-output/implementation-artifacts/4-1-confirmacao-de-pagamento-simulado-com-emissao-de-ingresso.md — Ingresso/StatusIngresso/CodigoIngressoService especificados, mesmo aviso de dependência viva]
- [Source: _bmad-output/implementation-artifacts/3-1-mapa-de-assentos-publico.md — precedente de rota pública com permitAll() cirúrgico e tela pública com estados loading/nao-encontrado/erro/pronto]
- [Source: api/src/main/resources/db/migration/V1__schema.sql — schema de `ingressos`, `reservas`, `assentos`, `sessoes`, `salas`]
- [Source: código existente lido por completo nesta criação de story: `sessoes.repository.AssentoSessaoRepository` (padrão JOIN ON), `config.SecurityConfig` (ordem de permitAll()), `common.{GlobalExceptionHandler,ApiError}`, `web/src/App.tsx`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Task 1: `IngressoRepository.buscarPorCliente()` adicionado com `JOIN ... ON` explícito
  (4 tabelas numa query só, sem N+1), mesmo padrão de `AssentoSessaoRepository.buscarMapaPorSessao()`
  (Story 3.1). `IngressoResumoProjection` criada conforme spec.
- Task 2: `IngressoService.buscarPublico()` usa `CodigoIngressoService.extrairId(String):
  Optional<UUID>` (novo, adição aditiva ao Task 1 da Story 4.1 — mesma sugestão dos Dev
  Notes desta story) em vez de duplicar o parsing `split("\\.", 2)`. Assinatura checada
  antes de qualquer consulta ao banco (AC5). `ClienteNaoEncontradoException` (pacote
  `reservas`) reaproveitada, mesmo padrão de `PagamentoService`.
- Task 3: `SecurityConfig` ganhou o matcher autenticado de `/api/ingressos/minhas`
  declarado ANTES do `permitAll()` de `/api/ingressos/*` — armadilha real prevista pela
  própria story (os dois paths têm a mesma forma, um segmento só) e coberta por
  `IngressoSecurityTest` (`minhas` sem token → 401; com token `ORGANIZADOR` → 403).
  Decisão registrada em `docs/decisions.md`.
- Task 4: `web/src/api/ingressos.ts` + `MeusIngressosPage`/`IngressoPublicoPage` seguem o
  padrão de máquina de estado `loading/erro/vazio(ou nao-encontrado)/pronto` já usado por
  `ListagemSessoesPage`/`MapaAssentosPage`. Compartilhamento copia a URL pública pro
  clipboard (`navigator.clipboard`), com fallback silencioso — a URL também aparece no
  card, então falha de clipboard não bloqueia o fluxo. `npx tsc --noEmit`, `npm run lint`
  e `npm run build` verdes; testes novos (8) verdes — as 4 falhas pré-existentes em
  `client.test.ts`/`LoginPage.test.tsx` (`localStorage` undefined no jsdom) são anteriores
  a esta story, confirmado via `git stash` antes de tocar o código.
- Task 5: suíte completa verde — backend `mvn test` (165 testes), front-end `npx tsc
  --noEmit`, `npm run lint`, `npm run build`, `npx vitest run` (58 testes, 54 verdes + 4
  falhas pré-existentes não relacionadas). Três decisões registradas em `docs/decisions.md`:
  (a) ordem dos `requestMatchers` em `SecurityConfig`; (b) `buscarPublico()` valida
  assinatura antes do banco; (c) notação de rota `/api/ingressos/{codigo}` vs.
  `/ingressos/{codigo}` do PRD. Epic 4 completa — Stories 4.1 e 4.2 em `review`.

### File List

- `api/src/main/java/br/com/rolo35/api/ingressos/repository/IngressoResumoProjection.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/repository/IngressoRepository.java` (update — `buscarPorCliente()`)
- `api/src/test/java/br/com/rolo35/api/ingressos/repository/IngressoLeituraRepositoryTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/service/CodigoIngressoService.java` (update — `extrairId()`)
- `api/src/test/java/br/com/rolo35/api/ingressos/service/CodigoIngressoServiceTest.java` (update — testes de `extrairId()`)
- `api/src/main/java/br/com/rolo35/api/ingressos/IngressoNaoEncontradoException.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/IngressoResumoDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/IngressoPublicoDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java` (novo)
- `api/src/test/java/br/com/rolo35/api/ingressos/service/IngressoServiceTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/controller/IngressoController.java` (novo)
- `api/src/test/java/br/com/rolo35/api/ingressos/controller/IngressoControllerTest.java` (novo)
- `api/src/test/java/br/com/rolo35/api/ingressos/IngressoSecurityTest.java` (novo)
- `web/src/api/ingressos.ts` (novo)
- `web/src/pages/MeusIngressosPage.tsx` (novo)
- `web/src/pages/MeusIngressosPage.test.tsx` (novo)
- `web/src/pages/IngressoPublicoPage.tsx` (novo)
- `web/src/pages/IngressoPublicoPage.test.tsx` (novo)
- `web/src/App.tsx` (update — rotas `/meus-ingressos`, `/ingressos/:codigo`)
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (update — ordem de `permitAll()`)
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update — handler de `IngressoNaoEncontradoException`)
