---
baseline_commit: b5ff78e
---

# Story 4.3: Checkout de Pagamento no Front-End

Status: in-progress

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

<!-- Story criada fora do fluxo create-story: o tooling BMAD (`_bmad/`) não está instalado nesta
     máquina, só os outputs em `_bmad-output/`. Estrutura espelhada manualmente de
     4-2-meus-ingressos-e-link-publico.md. Se o tooling voltar, rodar validate-create-story antes
     do dev-story. -->

## Story

As a cliente autenticado com uma reserva ativa,
I want confirmar o pagamento pela interface e ver o resultado na tela,
so that eu completo a compra sem sair da aplicação e recebo meu ingresso com QR sem precisar de um cliente HTTP.

## Contexto: por que esta story existe

A Story 4.1 entregou `POST /api/pagamentos/confirmar` completo (lock pessimista, idempotência sob concorrência, emissão de ingresso com HMAC) e declarou explicitamente nos Dev Notes que **não** faria tela: *"Sem tela de front-end nesta story, por decisão de escopo explícita. O PRD/epics não descrevem uma UI própria de 'confirmar pagamento' com FR numerado (...) se for necessário validar manualmente, usar um cliente HTTP"*. A decisão foi correta pro escopo daquela story.

O efeito colateral é que o Epic 4 fechou com o back inteiro e nenhum caminho de UI: `MapaAssentosPage` cria a reserva e navega pra `/em-construcao` com a mensagem *"O pagamento ainda está sendo montado"* ([`web/src/pages/MapaAssentosPage.tsx:132`](../../web/src/pages/MapaAssentosPage.tsx)). Um cliente que reserva assentos hoje fica com o hold de 10 minutos preso e nenhuma forma de pagar pela aplicação.

Isso conflita com SM-1 e com o §"Fluxo vertical completo" do PRD, que exigem *login → busca → reserva → **pagamento simulado (aprovação e recusa)** → ingresso com QR* funcionando ponta a ponta. Esta story fecha a lacuna.

## Acceptance Criteria

1. **Given** um cliente autenticado que acabou de reservar assentos com sucesso **When** a reserva é criada **Then** ele é levado pra tela de pagamento daquela reserva (`/pagamento/{reservaId}`), que mostra filme, dia/hora da sessão, sala, os assentos escolhidos (fileira+número, não IDs), o total e um contador regressivo do tempo que falta pro hold expirar — todos os valores vindos do servidor, nenhum deles reconstruído a partir de suposição do cliente.

2. **Given** a tela de pagamento de uma reserva `ATIVA` e própria **When** o cliente preenche os campos de cartão, escolhe o resultado simulado `APROVAR` e confirma **Then** o front chama `POST /api/pagamentos/confirmar` com `{reservaId, resultadoSimulado: "APROVADO"}`, recebe `200 {status: "CONFIRMADA", ingressos: [...]}` e mostra um canhoto por ingresso emitido — cada um com o assento correspondente, o código assinado e um QR escaneável apontando pro link público (`/ingressos/{codigo}`), reusando o `CanhotoIngresso` já existente.

3. **Given** a mesma tela **When** o cliente escolhe o resultado simulado `RECUSAR` e confirma **Then** o front recebe `200 {status: "RECUSADA", ingressos: []}` e mostra a tela de recusa: pagamento recusado, assentos liberados pra outras pessoas, nenhum ingresso emitido e nada cobrado, com caminho de volta pro mapa da sessão e pra vitrine. Nenhum canhoto é renderizado.

4. **Given** uma reserva cujo hold já venceu **When** o cliente tenta confirmar **Then** o back responde `409 {codigo: "RESERVA_EXPIRADA"}` e o front mostra que a reserva expirou, com CTA pro mapa da mesma sessão (que recarrega com o estado atual dos assentos) — **e** o mesmo estado é alcançado sem round-trip quando o contador chega a zero com a tela aberta, sem que o botão de confirmar continue oferecendo uma ação que já não pode dar certo.

5. **Given** a URL `/pagamento/{reservaId}` aberta direto, recarregada (F5) ou restaurada pelo botão "voltar" do navegador **When** a página monta sem nenhum `state` de navegação **Then** ela se reconstrói inteira a partir de `GET /api/reservas/{id}` — o cliente não perde um checkout cuja reserva ainda está válida. Nenhum dado da tela depende de `location.state`, `sessionStorage` ou de ter passado pelo mapa de assentos nesta navegação. O destino é decidido pelo `status` que o servidor devolve: `ATIVA` → tela de pagamento; `RECUSADA` → tela de recusa, montada a partir do próprio `status` (a lista de assentos vem vazia, e isso é esperado); `CONFIRMADA` → redireciona pra `/meus-ingressos`, **nunca** uma tela de erro.

6. **Given** uma reserva que pertence a outro cliente, **ou** um `reservaId` que não existe **When** `GET /api/reservas/{id}` é chamado com token válido de `CLIENTE` **Then** as duas situações devolvem exatamente a mesma resposta `403 {codigo: "NAO_AUTORIZADO"}` — não é possível diferenciar "não é sua" de "não existe", mesmo raciocínio (e mesmo par status/código) da AC3 da Story 4.1.

7. **Given** os campos de cartão da tela (nome, número, validade, CVV) **When** o pagamento é confirmado **Then** o corpo da requisição contém **somente** `{reservaId, resultadoSimulado}` — nenhum dado de cartão é transmitido, nem gravado em `localStorage`/`sessionStorage`/cookie, nem incluído em log. Os campos são obrigatórios e validados no cliente antes do POST (formulário incompleto não dispara requisição nenhuma), mas servem só pra fidelidade da simulação.

8. **Given** um visitante sem sessão iniciada (ou com token que a API recusa) que escolheu assentos no mapa **When** ele clica em ir para o pagamento **Then** ele é levado pra tela de login em vez de receber uma mensagem que não oferece saída — e, ao autenticar como `CLIENTE`, volta pro mapa **da mesma sessão** com **os mesmos assentos já selecionados**, podendo concluir a reserva sem refazer a escolha. A seleção viaja pelo `state` de navegação, nunca por storage, e o mapa é recarregado do servidor na volta: assento que outra pessoa levou nesse meio-tempo não pode voltar selecionado.

   <!-- AC8 incorporada durante a implementação, a pedido do autor da story: mesma jornada de
        compra das AC1-AC7 (o caminho até o checkout), não um fluxo separado. -->

## Tasks / Subtasks

- [x] **Task 1 — `GET /api/reservas/{id}`: leitura da própria reserva com contexto de checkout (AC1, AC5, AC6)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/reservas/repository/ReservaCheckoutRepositoryTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `IngressoLeituraRepositoryTest` da Story 4.2): popular sessão + sala + assentos + uma reserva `ATIVA` com 2 assentos reivindicados; `buscarAssentosDaReserva(reservaId)` devolve as 2 linhas com `fileira`/`numero`/`sessaoTitulo`/`salaNome`/`dataHora`/`preco` já resolvidos numa query só (sem N+1 — non-negotiable do projeto), ordenadas por `fileira, numero`; reserva de outra sessão não vaza no resultado. Rodar e confirmar que falha por o método não existir.
  - [x] **[GREEN]** Criar `sessoes/repository/ReservaCheckoutProjection.java` (`getAssentoId(): Long`, `getFileira(): String`, `getNumero(): Integer`, `getSessaoTitulo(): String`, `getSalaNome(): String`, `getDataHora(): LocalDateTime`, `getPreco(): BigDecimal`) e adicionar em `sessoes/repository/AssentoSessaoRepository.java` (mesmo arquivo de `buscarMapaPorSessao()`, mesmo padrão de `JOIN ... ON` sem associação mapeada):
    ```java
    @Query("""
        SELECT a.id AS assentoId, a.fileira AS fileira, a.numero AS numero,
               s.titulo AS sessaoTitulo, sa.nome AS salaNome, s.dataHora AS dataHora, s.preco AS preco
        FROM AssentoSessao asx
        JOIN Assento a ON a.id = asx.id.assentoId
        JOIN Sessao s ON s.id = asx.id.sessaoId
        JOIN Sala sa ON sa.id = s.salaId
        WHERE asx.reservaId = :reservaId
        ORDER BY a.fileira, a.numero
        """)
    List<ReservaCheckoutProjection> buscarAssentosDaReserva(Long reservaId);
    ```
    A projeção fica em `sessoes.repository` (não em `reservas.repository`) porque mora no repositório de `AssentoSessao`, que é entidade de `sessoes` — mesma direção de dependência que `PagamentoService` já usa ao consumir esse repositório. **Índice**: `asx.reservaId` (coluna `assento_sessao.reserva_id`) vira coluna de filtro de produção pela primeira vez com esta query — checar se `V1__schema.sql`/`V4__indices_ingressos_por_cliente.sql` já cobrem; se não, criar `V5__indice_assento_sessao_reserva.sql`, mesmo raciocínio do achado de code review da Story 4.2 que gerou a V4.
  - [x] Commit: `feat(reservas): projeção de checkout da reserva sem N+1 (AC1, AC5)`

- [x] **Task 2 — `ReservaService.buscarParaCheckout()` + rota `GET /api/reservas/{id}` (AC1, AC5, AC6)**
  - [x] **[RED]** Estender `api/src/test/java/br/com/rolo35/api/reservas/service/ReservaServiceTest.java` (Mockito puro, já existe): (a) reserva própria e existente → `ReservaCheckoutDto` com `id/sessaoId/status/expiresAt` da `Reserva` e `sessaoTitulo/salaNome/dataHora/preco/assentos` da projeção; (b) reserva de **outro** `clienteId` → `NaoAutorizadoException`, sem chamar a projeção; (c) `reservaId` inexistente → **a mesma** `NaoAutorizadoException` (AC6 — não diferenciar); (d) o método não chama `findByIdForUpdate` nem nenhum `save`/`@Modifying` — é leitura pura, não pode adquirir lock pessimista nem mutar nada (`verify(reservaRepository, never()).findByIdForUpdate(any())`, `verify(reservaRepository, never()).save(any())`). Rodar e confirmar que falha.
  - [x] **[GREEN — refactor primeiro, comportamento inalterado]** Mover `pagamentos/NaoAutorizadoException.java` → `common/NaoAutorizadoException.java`, ajustando o import em `PagamentoService`, `GlobalExceptionHandler` e nos testes que a referenciam. Rodar a suíte inteira do back antes de seguir: é movimentação de pacote, o `403 {codigo: "NAO_AUTORIZADO"}` não muda, e nenhum teste deve precisar de mudança além do import — se algum precisar, parar e entender por quê.
    **Por que mover em vez de criar `reservas.ReservaNaoAutorizadaException`**: já existem *quatro* origens do mesmo `403 NAO_AUTORIZADO` (`pagamentos.NaoAutorizadoException`, `sessoes.SessaoNaoPertenceAoOrganizadorException`, o handler de `AccessDeniedException`, e agora `reservas`). Uma classe nova aqui seria a segunda cópia de uma exceção que já nasceu com nome genérico. `common` é onde `GlobalExceptionHandler` e `ApiError` já moram, então nenhuma direção de dependência se inverte — ao contrário de `reservas` importar de `pagamentos`, que inverteria o que `docs/decisions.md` registrou pra Story 4.1. **`SessaoNaoPertenceAoOrganizadorException` não entra no refactor**: o nome carrega significado no throw site e nos testes, e colapsá-la numa genérica perderia informação. O objetivo é parar de multiplicar cópias, não uniformizar tudo.
  - [x] **[GREEN]** `ReservaService.buscarParaCheckout()` lança a `common.NaoAutorizadoException` nos dois casos da AC6. Criar `reservas/dto/ReservaCheckoutDto.java` e `reservas/dto/AssentoReservadoDto.java`:
    ```java
    public record AssentoReservadoDto(Long id, String fileira, Integer numero) {}

    public record ReservaCheckoutDto(
            Long id, Long sessaoId, StatusReserva status, LocalDateTime expiresAt,
            String sessaoTitulo, String salaNome, LocalDateTime dataHora, BigDecimal preco,
            List<AssentoReservadoDto> assentos) {}
    ```
    Adicionar `buscarParaCheckout(Long reservaId, String clienteEmail)` em `ReservaService`, usando `findById` (**não** `findByIdForUpdate` — leitura pura) e `ClienteNaoEncontradoException` pro token órfão, mesmo padrão de `PagamentoService.confirmar()`.
  - [x] **[RED]** Estender `api/src/test/java/br/com/rolo35/api/reservas/controller/ReservaControllerTest.java` (`@WebMvcTest`, service mockado): `GET /api/reservas/{id}` com token `CLIENTE` → `200` + shape de `ReservaCheckoutDto`; service lança `NaoAutorizadoException` → `403 NAO_AUTORIZADO`. Estender `ReservaSecurityTest.java`: `GET /api/reservas/{id}` sem token → `401`; com token `ORGANIZADOR` → `403`; com token `PORTARIA` → `403` (a matriz de papéis completa, achado de code review recorrente nas stories anteriores).
  - [x] **[GREEN]** Adicionar em `ReservaController`:
    ```java
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<ReservaCheckoutDto> buscarParaCheckout(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(reservaService.buscarParaCheckout(id, authentication.getName()));
    }
    ```
    **Nenhuma mudança em `SecurityConfig`** — `/api/reservas/**` já cai no `anyRequest().authenticated()`, e o papel é decidido pelo `@PreAuthorize`. Diferente da Story 4.2, aqui não há rota pública nova, então não existe a armadilha de ordem de matchers.
  - [x] Commit: `feat(reservas): GET /api/reservas/{id} pra retomar o checkout (AC1, AC5, AC6)`

- [x] **Task 3 — `ApiRequestError` passa a carregar o `codigo` do `ApiError` (pré-requisito de AC4)**
  - [x] **[RED]** Estender `web/src/api/client.test.ts`: resposta de erro com corpo `{codigo: "RESERVA_EXPIRADA", mensagem: "..."}` → o `ApiRequestError` lançado expõe `.codigo === 'RESERVA_EXPIRADA'` além de `.status` e `.message`; corpo de erro sem `codigo` (ou não-JSON) → `.codigo` é `undefined`, sem quebrar. Rodar e confirmar que falha.
  - [x] **[GREEN]** Em `web/src/api/client.ts`: `ApiRequestError` ganha `readonly codigo?: string` como **terceiro parâmetro opcional** do construtor (assinatura `(message, status)` continua válida — nenhum call site existente muda), e `apiFetch` passa `body.codigo` quando presente, com a mesma checagem defensiva de tipo que já existe pra `body.mensagem`.
  - [x] **Por que isto é pré-requisito e não escopo inflado**: o pagamento tem **dois** erros distintos no mesmo status `409` — `RESERVA_EXPIRADA` (terminal: refazer a seleção) e `RESERVA_EM_DISPUTA` (transitório: tentar de novo). Sem o `codigo`, o front não consegue distinguir e trataria uma contenção momentânea como reserva perdida. A mesma colisão já existe latente na Story 3.2 (`ASSENTO_INDISPONIVEL` vs `ASSENTO_EM_DISPUTA`, ambos `409`, hoje tratados igual em `MapaAssentosPage`) — **não** corrigir aquele call site nesta story; só registrar em `deferred-work.md` que a ferramenta pra corrigir passou a existir.
  - [x] Commit: `feat(web): ApiRequestError carrega o codigo do envelope de erro`

- [ ] **Task 4 — Módulos de API do front: `pagamentos.ts` e `buscarReserva()` (AC2, AC3, AC5, AC7)**
  - [ ] Criar `web/src/api/pagamentos.ts` (novo módulo por domínio, AD-2):
    ```ts
    export type ResultadoSimulado = 'APROVADO' | 'RECUSADO';
    export interface IngressoEmitido { id: string; assentoId: number; codigo: string }
    export interface Pagamento { status: 'CONFIRMADA' | 'RECUSADA'; ingressos: IngressoEmitido[] }
    export function confirmarPagamento(request: { reservaId: number; resultadoSimulado: ResultadoSimulado }): Promise<Pagamento>
    ```
    A assinatura de `confirmarPagamento` é a prova estrutural da AC7: não existe parâmetro onde dado de cartão caiba.
  - [ ] Em `web/src/api/reservas.ts`, adicionar `AssentoReservado`/`ReservaCheckout` e `buscarReserva(id: number): Promise<ReservaCheckout>` (`GET /api/reservas/${id}`). Manter `Reserva`/`reservarAssentos` como estão — o `POST` continua devolvendo o `ReservaDto` enxuto.
  - [ ] Commit: `feat(web): api de pagamentos e leitura de reserva pro checkout`

- [ ] **Task 5 — `PagamentoPage`: checkout, aprovação, recusa e expiração (AC1-AC5, AC7)**
  - [ ] **[RED]** Criar `web/src/pages/PagamentoPage.test.tsx` (vitest + testing-library, mesmo estilo de `MapaAssentosPage.test.tsx`), um teste por comportamento, todos com `buscarReserva`/`confirmarPagamento` mockados via `vi.spyOn`:
    - monta a partir da URL: mostra título, dia/hora, sala, os assentos como `A1`/`A2` (não IDs) e o total = `preco × assentos.length` — **sem nenhum `state` de navegação** (prova de AC5: o teste renderiza a rota direto, como um F5 faria)
    - `403` do `buscarReserva` → mensagem de acesso negado, sem formulário (AC6)
    - aprovação: preenche cartão, escolhe `APROVAR`, confirma → chama `confirmarPagamento` com **exatamente** `{reservaId, resultadoSimulado: 'APROVADO'}` (assert do objeto inteiro, não `expect.objectContaining` — é o teste da AC7) e renderiza um canhoto por ingresso, com o código de cada um
    - recusa: escolhe `RECUSAR`, confirma → renderiza a tela de recusa e **nenhum** canhoto (`queryByText(/escaneie na portaria/i)` ausente)
    - formulário incompleto → confirmar não dispara requisição nenhuma (`expect(confirmarPagamento).not.toHaveBeenCalled()`) e mostra o aviso
    - `409 RESERVA_EXPIRADA` → estado de expirada com link pro mapa da sessão; `409 RESERVA_EM_DISPUTA` → aviso de tentar de novo, com o botão ainda habilitado (prova de que os dois `409` não são tratados igual — é o teste que justifica a Task 3)
    - contador zera com a tela aberta (`vi.useFakeTimers()` + `expiresAt` no passado próximo) → mesmo estado de expirada, sem ter chamado `confirmarPagamento` (AC4, metade sem round-trip)
    - `buscarReserva` devolve `status: 'CONFIRMADA'` → redireciona pra `/meus-ingressos`, sem renderizar formulário nem tela de erro (AC5)
    - `buscarReserva` devolve `status: 'RECUSADA'` com `assentos: []` → renderiza a tela de recusa, sem quebrar na lista vazia (AC5)
    Rodar e confirmar que falham por a página não existir.
  - [ ] **[GREEN]** Criar `web/src/pages/PagamentoPage.tsx`. Máquina de estado `loading | nao-autorizado | erro | pronto | expirada | recusada | aprovada`, mesmo formato de `MapaAssentosPage`/`MeusIngressosPage`. No mount, despachar pelo `status` da reserva antes de montar o formulário: `CONFIRMADA` → `<Navigate to="/meus-ingressos" replace />`, `RECUSADA` → estado `recusada`, `ATIVA` → estado `pronto`. Layout do handoff (`isPagamento`, linhas 541-617 do bundle novo): cabeçalho com kicker `RESERVA ATIVA` + `PAGAMENTO`, caixa escura do contador (`RESERVA EXPIRA EM`), formulário de cartão à esquerda e aside `SUA RESERVA` à direita. Reusar `PageShell`/`SectionTitle`/`TextField`/`Button`/`Alert`; a tela de aprovação reusa `CanhotoIngresso` (`isTicket`, linhas 633-684) e a de recusa segue `isRecusado` (linhas 619-631). Os campos de cartão vivem só em `useState` local, com `autoComplete="off"` — nunca em storage.
  - [ ] Commit: `feat(pagamentos): tela de checkout com aprovação, recusa e expiração (AC1-AC5, AC7)`

- [ ] **Task 6 — Ligar o mapa de assentos ao checkout e registrar a rota (AC1)**
  - [ ] **[RED]** Estender `web/src/pages/MapaAssentosPage.test.tsx`: reserva bem-sucedida → navega pra `/pagamento/{id}` usando o `id` que `reservarAssentos` devolveu (hoje o retorno é descartado e a navegação vai pra `/em-construcao`). Rodar e confirmar que falha.
  - [ ] **[GREEN]** Em `MapaAssentosPage.handleReservar()`, capturar o retorno de `reservarAssentos` e `navigate(\`/pagamento/${reserva.id}\`)`. Em `web/src/App.tsx`, registrar `<Route path="/pagamento/:reservaId" element={<PagamentoPage />} />` dentro do `<Route element={<Layout />}>`, mesmo padrão das outras rotas de cliente.
  - [ ] A rota `/em-construcao` **continua existindo** — ainda é destino de `/cadastro` e da área da portaria; só deixa de ser destino do fluxo de pagamento.
  - [ ] Commit: `feat(reservas): mapa de assentos leva pro checkout em vez de /em-construcao (AC1)`

- [ ] **Task 7 — Retomada da compra depois do login (AC8)**
  - [ ] **[RED]** Estender `web/src/pages/MapaAssentosPage.test.tsx`: reserva recusada com `401` (e com `403`) → navega pra `/login`, **sem** chamar `reservarAssentos` de novo, levando no `state` a sessão de origem e os assentos escolhidos; e, ao montar o mapa com esse `state` de volta, os assentos daquela lista aparecem selecionados e o total já reflete a seleção — mas um assento que voltou do servidor como `RESERVADO`/`VENDIDO` **não** é reselecionado. Estender `web/src/pages/LoginPage.test.tsx`: login bem-sucedido com `state` de retorno → navega pro caminho de origem repassando a seleção, em vez do destino padrão do papel.
  - [ ] **[GREEN]** `MapaAssentosPage`: no `401/403` de `reservarAssentos`, `navigate('/login', { state: { retomarEm, assentoIds } })`; no mount, semear `selecionados` a partir do `state`, filtrando pelo mapa recém-carregado. `LoginPage`: depois de autenticar, honrar `retomarEm` quando existir. Nada em `localStorage`/`sessionStorage` — a seleção é estado de navegação, e a autoridade sobre disponibilidade continua sendo o mapa que o servidor devolve.
  - [ ] Commit: `feat(reservas): retoma a compra no mapa depois do login (AC8)`

- [ ] **Task 8 — Confirmação final (sem código novo, checklist de saída)**
  - [ ] Rodar a suíte completa (back `mvn test`; front `npm test`, `npm run build`, `npm run lint`) e confirmar tudo verde.
  - [ ] Registrar em `docs/decisions.md`: (a) por que `GET /api/reservas/{id}` existe — retomada de checkout depois de F5, e por que ele **não** usa `findByIdForUpdate` como todo o resto do domínio (leitura pura, AD-4 não se aplica); (b) por que o contador de hold é informativo e a autoridade sobre expiração é sempre o `409` do servidor (clock skew); (c) por que `ApiRequestError` passou a carregar `codigo` (dois `409` distintos no mesmo fluxo); (d) por que `NaoAutorizadoException` subiu pra `common` e por que `SessaoNaoPertenceAoOrganizadorException` ficou onde estava; (e) por que a seleção de assentos sobrevive ao login pelo `state` de navegação e não por storage, e por que ela ainda passa pelo filtro do mapa recarregado (AC8).
  - [ ] Registrar em `deferred-work.md`: `MapaAssentosPage` continua tratando `ASSENTO_INDISPONIVEL` e `ASSENTO_EM_DISPUTA` como o mesmo `409`, embora o `codigo` agora esteja disponível pra distinguir — fora do escopo desta story.
  - [ ] Atualizar o Status desta story pra `review` e `sprint-status.yaml`.
  - [ ] Commit: `docs(pagamentos): confirmação final e fecha Story 4.3 pra review`

## Dev Notes

- **O contador de hold é informativo; a autoridade é o servidor.** O `expiresAt` vem de `GET /api/reservas/{id}`, mas a contagem regressiva roda contra o relógio do navegador, que pode estar adiantado ou atrasado em relação ao da API. Isso é aceitável pro que o contador faz (dar noção de urgência) e **não** é aceitável como decisão de negócio: quem decide se a reserva expirou é sempre o `409 RESERVA_EXPIRADA` do back, dentro do lock (AC4 da Story 4.1). O contador chegar a zero desabilita o botão e mostra o estado de expirada — não porque o front "sabe" que expirou, mas porque não faz sentido oferecer uma ação que o servidor vai recusar. O caminho inverso (contador ainda positivo, servidor recusa) precisa funcionar igual, e é por isso que o tratamento do `409` não é opcional mesmo com o contador implementado.

- **`GET /api/reservas/{id}` é leitura pura e não pode virar `findByIdForUpdate`.** Todo o resto do domínio `reservas`/`pagamentos` carrega `Reserva` com `PESSIMISTIC_WRITE` porque está prestes a escrever. Este método não escreve — travar a reserva a cada abertura da tela de checkout (ou a cada F5) criaria contenção contra o `POST /api/pagamentos/confirmar` do próprio cliente, num recurso que é justamente o gargalo do fluxo. Mesmo racional de AD-9 pra rota pública de ingresso, aplicado aqui a uma rota autenticada.

- **Reserva `RECUSADA` some do checkout, e isso é esperado.** `AssentoSessaoRepository.liberar()` (Story 4.1) zera `reserva_id` das linhas ao recusar, então `buscarAssentosDaReserva()` devolve lista vazia pra uma reserva recusada. A tela não precisa lidar com isso como caso especial: depois da recusa o cliente já está na tela de recusa, e um F5 nessa URL cai numa reserva `RECUSADA` sem assentos — renderizar a própria tela de recusa a partir do `status` da reserva (não da lista de assentos) resolve.

- **Reserva `CONFIRMADA` não é reconstruível nesta tela — por isso o redirect.** `reivindicarVendido()` **não** zera `reserva_id`, então os assentos continuam vindo; o que não vem são os **códigos assinados dos ingressos**, que só existem na resposta do `POST /api/pagamentos/confirmar` e não são recuperáveis por `GET /api/reservas/{id}`. Sem tratamento, um F5 na tela de aprovação renderizaria uma compra bem-sucedida como erro. As alternativas eram (a) redirecionar pra `/meus-ingressos`, onde os canhotos já existem, ou (b) incluir `ingressos` no `ReservaCheckoutDto` — o que obrigaria `ReservaService` a depender de `CodigoIngressoService` e engordaria um DTO de leitura com dado que o caminho normal não usa. Fica (a). O que se perde no refresh é a tela de comemoração ("TICKET NA MÃO"), não informação. Note que este caso é mais brando que o da reserva `ATIVA`: nada se perde de verdade, os ingressos existem e os assentos já são `VENDIDO` — mas mandar o cliente pra uma tela de erro depois de uma compra que deu certo é inaceitável de qualquer forma.

- **AC7 é estrutural, não só comportamental.** O jeito de garantir que dado de cartão não vaza não é lembrar de não enviar — é `confirmarPagamento` não ter parâmetro onde caiba, e os campos viverem em `useState` local. O teste que assert o corpo exato da requisição (`toHaveBeenCalledWith({reservaId, resultadoSimulado})`, objeto completo, não `objectContaining`) é o que trava isso contra regressão. Não adicionar `autoComplete` de cartão real (`cc-number`, `cc-exp`) — convidaria o navegador a salvar dado de cartão de verdade num formulário que é teatro.

- **Dois `409` diferentes no mesmo fluxo — a Task 3 existe por causa disso.** `RESERVA_EXPIRADA` é terminal (os assentos já eram; refazer a seleção) e `RESERVA_EM_DISPUTA` é transitório (o `lock_timeout` de 3s estourou; a mesma ação tem chance de dar certo em seguida). Tratar os dois igual seria mandar o cliente refazer uma seleção que nunca precisou ser refeita, liberando um hold que ainda era dele. `ApiRequestError` hoje só carrega `status` e `message` — daí o pré-requisito.

- **Não inventar mais back do que a story pede.** O `IngressoDto` que `POST /api/pagamentos/confirmar` devolve é enxuto de propósito (`id`, `assentoId`, `codigo`) e **não** vai ganhar título/sala/data pra alimentar a tela de aprovação: esses campos a página já tem, vindos do `GET /api/reservas/{id}` que ela usou pra montar. Enriquecer o DTO de pagamento duplicaria dado que a tela já carrega e ampliaria a resposta de um endpoint de escrita por conveniência de UI.

- **O handoff visual das três telas é fornecido à parte, direto pelo autor da story** — não está versionado no repositório e a story não depende de nenhum arquivo externo pra ser lida. Pedir antes de começar a Task 5. Duas divergências já decididas em relação ao protótipo: (a) ele simula o hold com `Date.now() + 10 min` no cliente — **não copiar**, o `expiresAt` real vem do servidor; (b) ele desenha um QR decorativo — o real é gerado por `CanhotoIngresso` via `qrcode.react`. Nomes das telas no protótipo: `isPagamento`, `isRecusado` e a de ticket emitido.

- **Peças já existentes pra reusar, todas commitadas em `epic-4-pagamento-e-ingressos`**: `CanhotoIngresso` (canhoto + QR real via `qrcode.react`), `SeloStatusIngresso`, `urlPublicaDoIngresso`, além de `PageShell`/`SectionTitle`/`TextField`/`Button`/`Alert`. A tela de aprovação desta story não desenha canhoto novo.

### Project Structure Notes

- Nenhum pacote novo no back — estende `reservas/` (nascido na Story 3.2) e `sessoes/repository` (projeção).
- **Back-end (novo)**: `reservas/dto/ReservaCheckoutDto.java`; `reservas/dto/AssentoReservadoDto.java`; `sessoes/repository/ReservaCheckoutProjection.java`; `api/src/test/java/br/com/rolo35/api/reservas/repository/ReservaCheckoutRepositoryTest.java`; possível `db/migration/V5__indice_assento_sessao_reserva.sql`.
- **Back-end (movido)**: `pagamentos/NaoAutorizadoException.java` → `common/NaoAutorizadoException.java` (Task 2, refactor sem mudança de comportamento; ajusta imports em `PagamentoService`, `GlobalExceptionHandler` e testes).
- **Back-end (update)**: `sessoes/repository/AssentoSessaoRepository.java` (`buscarAssentosDaReserva()`); `reservas/service/ReservaService.java` (`buscarParaCheckout()`); `reservas/controller/ReservaController.java` (`GET /{id}`); testes `ReservaServiceTest`, `ReservaControllerTest`, `ReservaSecurityTest`. **`GlobalExceptionHandler` não ganha handler novo** — o de `NaoAutorizadoException` já existe e passa a atender os dois domínios.
- **Front-end (novo)**: `web/src/api/pagamentos.ts`; `web/src/pages/PagamentoPage.tsx` + `.test.tsx`.
- **Front-end (update)**: `web/src/api/client.ts` + `client.test.ts` (`codigo`); `web/src/api/reservas.ts` (`buscarReserva`); `web/src/pages/MapaAssentosPage.tsx` + `.test.tsx` (destino da navegação); `web/src/App.tsx` (rota `/pagamento/:reservaId`).
- **Documentação (update)**: `docs/decisions.md`; `_bmad-output/implementation-artifacts/deferred-work.md`; `sprint-status.yaml`.
- **Leitura obrigatória antes de codar**: `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java` (contrato exato do que o front consome, incluindo o caminho idempotente), `.../sessoes/repository/AssentoSessaoRepository.java` (padrão `JOIN ... ON`, e o que `liberar()`/`reivindicarVendido()` fazem com `reserva_id`), `.../common/GlobalExceptionHandler.java` (todos os códigos que a tela precisa distinguir), `web/src/pages/MapaAssentosPage.tsx` (máquina de estado e tratamento de `409` de referência), `web/src/components/CanhotoIngresso.tsx`, `_bmad-output/implementation-artifacts/4-1-confirmacao-de-pagamento-simulado-com-emissao-de-ingresso.md` (Dev Notes de por que a tela ficou de fora lá).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: Checkout de Pagamento no Front-End]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md — §4.5 FR-12 (pagamento simulado com parâmetro de teste), FR-13 (idempotência); §SM-1 e §"Fluxo vertical completo", que exigem o caminho de UI ponta a ponta]
- [Source: _bmad-output/implementation-artifacts/4-1-confirmacao-de-pagamento-simulado-com-emissao-de-ingresso.md — contrato de `POST /api/pagamentos/confirmar`, AC3 (403 que não revela existência), e o Dev Note que adiou a tela]
- [Source: _bmad-output/implementation-artifacts/4-2-meus-ingressos-e-link-publico.md — precedente de story com back + front na mesma spec]
- [Source: _bmad-output/implementation-artifacts/3-2-reserva-de-assentos-com-hold-temporario.md — origem do hold de 10 min e do `expiresAt`]
- [Source: docs/decisions.md — `NaoAutorizadoException` em `pagamentos` e direção de dependência `pagamentos → reservas`]
- [Source: código existente lido por completo nesta criação de story: `reservas.{Reserva,StatusReserva}`, `reservas.repository.ReservaRepository`, `reservas.controller.ReservaController`, `reservas.dto.ReservaDto`, `pagamentos.controller.PagamentoController`, `pagamentos.dto.{PagamentoDto,IngressoDto,ConfirmarPagamentoRequest}`, `sessoes.repository.AssentoSessaoRepository`, `common.GlobalExceptionHandler`, `config.SecurityConfig`, `web/src/api/{client,reservas,ingressos}.ts`, `web/src/pages/{MapaAssentosPage,MeusIngressosPage,IngressoPublicoPage}.tsx`, `web/src/components/*`]
- [Source: handoff visual das telas `isPagamento`/`isRecusado`/ticket — fornecido à parte pelo autor da story, não versionado]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
