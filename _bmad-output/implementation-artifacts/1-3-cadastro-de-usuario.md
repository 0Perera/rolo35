---
baseline_commit: 93a4c04
---

# Story 1.3: Cadastro de Usuário

Status: done

<!-- Nota: validação é opcional. Rode validate-create-story pra uma checagem de qualidade antes de dev-story. -->

## Story

As a visitante sem conta,
I want criar minha própria conta escolhendo o papel (ORGANIZADOR, CLIENTE ou PORTARIA),
so that eu consiga operar no sistema com o papel certo sem depender de um cadastro feito manualmente por outra pessoa — inclusive pra avaliação/teste do sistema.

## Acceptance Criteria

1. Given nome/e-mail/senha/papel válidos (papel dentre `ORGANIZADOR`, `CLIENTE`, `PORTARIA`) e e-mail ainda não usado — When submete — Then uma conta com o papel informado é criada, senha armazenada com hash (nunca em texto puro), e o fluxo segue pro login (ou já retorna token, a critério da implementação).
2. Given um cadastro com e-mail já existente — When submetido — Then retorna erro claro via envelope `{codigo, mensagem}`, sem confirmar/negar implicitamente se o e-mail pertence a outra conta de forma que vaze dado sensível.
3. Given o endpoint de cadastro chamado com `papel` ausente ou fora do conjunto `{ORGANIZADOR, CLIENTE, PORTARIA}` — When submetido — Then validação de campo rejeita antes de tocar o banco, sem criar conta.
4. Given senha ou e-mail em formato inválido — When submetido — Then validação de campo (`@Valid`) rejeita antes de tocar o banco, com mensagem de erro por campo.

## Tasks / Subtasks

- [x] **Task 1 — `Papel` enum + `CadastroRequest` DTO (AC: 1, 3, 4)**
  - [x] **[RED]** `CadastroRequestValidationTest` (ou seção equivalente em teste de validação de bean): `papel` nulo falha `@NotNull`; `nome`/`email`/`senha` em branco falham `@NotBlank`; `email` mal formatado falha `@Email`; `senha` com menos de 6 chars falha `@Size(min=6)`
  - [x] **[GREEN]** Cria `auth/Papel.java`: `public enum Papel { ORGANIZADOR, CLIENTE, PORTARIA }`
  - [x] **[GREEN]** Cria `auth/dto/CadastroRequest.java`: `record CadastroRequest(@NotBlank String nome, @NotBlank @Email String email, @NotBlank @Size(min = 6) String senha, @NotNull Papel papel) {}`
  - [x] Commit: `feat(auth): enum Papel e CadastroRequest com papel selecionável (Story 1.3)`

- [x] **Task 2 — Erro de e-mail duplicado (AC: 2)**
  - [x] **[RED]** Teste (unit, ver Task 4) esperando `EmailJaCadastradoException` quando `findByEmail` retorna usuário existente
  - [x] **[GREEN]** Cria `auth/EmailJaCadastradoException.java` (mesmo padrão de `CredenciaisInvalidasException`: `RuntimeException`, sem argumentos, mensagem fixa "E-mail já cadastrado")
  - [x] **[GREEN]** Adiciona handler em `GlobalExceptionHandler`: `@ExceptionHandler(EmailJaCadastradoException.class)` → `409 CONFLICT`, `ApiError("EMAIL_JA_CADASTRADO", "E-mail já cadastrado")`
  - [x] Commit: `feat(auth): erro 409 pra e-mail já cadastrado`

- [x] **Task 3 — Construtor de registro em `Usuario` (AC: 1)**
  - [x] **[GREEN]** Adiciona `Usuario(String nome, String email, String senhaHash, String papel)` em `Usuario.java`, setando `createdAt = Instant.now()` (mesmo padrão do branch de referência — ver Dev Notes). Não mexe no construtor/campos existentes.
  - [x] Commit: `feat(auth): construtor de registro em Usuario`

- [x] **Task 4 — `AuthService.cadastrar(CadastroRequest)` (AC: 1, 2)**
  - [x] **[RED]** `AuthServiceTest`: `cadastrarCriaUsuarioComPapelInformadoERetornaToken` parametrizado pelos 3 papéis (`ArgumentCaptor<Usuario>` confirma `papel` salvo = `papel.name()` do request); `cadastrarLancaEmailJaCadastradoQuandoEmailExiste` (verifica `repository.save` nunca chamado)
  - [x] **[GREEN]** Implementa `cadastrar()` em `AuthService`: normaliza e-mail (`trim().toLowerCase(Locale.ROOT)`, mesmo padrão de `login()`), `findByEmail` → lança `EmailJaCadastradoException` se presente; senão `passwordEncoder.encode(senha)`, monta `Usuario` com `papel.name()`, `repository.save(...)`, gera JWT via `jwtService.generateToken(email, papel)` (assinatura já existente), retorna `new LoginResponse(token, papel)`
  - [x] **[REFACTOR]** Confere que `login()` e `cadastrar()` não duplicam a normalização de e-mail sem necessidade (extrair só se ficar repetitivo, sem exagerar)
  - [x] Commit: `feat(auth): AuthService.cadastrar cria conta com o papel informado`

- [x] **Task 5 — `POST /api/auth/cadastro` (AC: 1, 2, 3, 4)**
  - [x] **[RED]** `AuthControllerTest`: 200 com token pra cada um dos 3 papéis; 409 `EMAIL_JA_CADASTRADO` em duplicidade; 400 `PARAMETRO_INVALIDO` com `papel` ausente; 400 `CORPO_INVALIDO` com `papel` fora do conjunto (string inválida — deserialização de enum falha, cai no handler genérico de `HttpMessageNotReadableException` já existente); 400 `PARAMETRO_INVALIDO` com e-mail/senha mal formatados
  - [x] **[GREEN]** Adiciona `@PostMapping("/api/auth/cadastro")` em `AuthController` (path completo: a classe não tem `@RequestMapping`, o `POST /login` vizinho também traz o path inteiro), delega pra `authService.cadastrar(request)`
  - [x] Commit: `feat(auth): endpoint POST /api/auth/cadastro (AC1-4)`

- [x] **Task 6 — Libera a rota no filtro de segurança (AC: 1)**
  - [x] **[GREEN]** Adiciona `/api/auth/cadastro` ao mesmo grupo `permitAll()` de `/api/auth/login` em `SecurityConfig`
  - [x] Confirma (reexecutando os testes da Task 5) que sem essa liberação a rota cairia em `401 NAO_AUTENTICADO` por padrão
  - [x] Commit: `feat(auth): libera /api/auth/cadastro no filtro de segurança`

- [x] **Task 7 — Cliente de API no front (AC: 1, 2, 3, 4)**
  - [x] **[GREEN]** Adiciona em `web/src/api/auth.ts`: `cadastrar(nome: string, email: string, senha: string, papel: Papel): Promise<LoginResponse>` → `POST /api/auth/cadastro`, mesmo padrão de `login()`
  - [x] Commit: `feat(web): cliente de API pra cadastro de usuário`

- [x] **Task 8 — Tela de cadastro com seleção de papel (AC: 1, 3, 4)**
  - [x] **[GREEN]** Cria `web/src/pages/CadastroPage.tsx`: mesmo shell de `LoginPage.tsx` (`PageShell variant="auth"`, `Card`, `TextField`, `Alert`, `Button`), campos nome/email/senha + seletor de papel em três botões com `aria-pressed` (as 3 opções, sem pré-seleção — força escolha explícita); validação client-side espelhando as regras do back (campos não-vazios pelo texto aparado como o `@NotBlank`, senha ≥ 6 medida no texto cru como o `@Size(min = 6)`, papel obrigatório); ao sucesso grava `rolo35.token`/`rolo35.papel` em `localStorage` via `salvarSessao` e navega via `rotaPorPapel` (importado de `LoginPage.tsx`); erro do back exibido via `Alert` (mesmo padrão de tratamento de `ApiRequestError` de `LoginPage.tsx`)
  - [x] Commit: `feat(web): tela de cadastro com seleção de papel`

- [x] **Task 9 — Liga a rota real (AC: 1)**
  - [x] **[GREEN]** Em `App.tsx`, troca o `<Route path="/cadastro" element={<PapelPlaceholderPage .../>} />` (placeholder atual, que menciona "autocadastro de cliente... Story 1.3") pelo `<CadastroPage />` real; remove o import de `PapelPlaceholderPage` se não sobrar nenhum outro uso
  - [x] Commit: `feat(web): liga a rota /cadastro na tela real`

- [x] **Task 10 — Contrato da tela de cadastro (AC: 1, 2, 3, 4)**
  - [x] Escrito depois do componente pronto, por convenção do projeto (cobertura leve de interação visual, focada em contrato de comportamento — instruções do projeto, tabela de tipos de teste)
  - [x] `web/src/pages/CadastroPage.test.tsx` (Vitest + Testing Library + `userEvent`, `MemoryRouter`): submete com os 3 papéis e confirma `cadastrar` chamado com os argumentos certos e navegação por `rotaPorPapel`; erro do back (mock rejeitando com `ApiRequestError`) aparece via `screen.findByRole('alert')`; tentar submeter sem escolher papel não chama a API
  - [x] Commit: `test(web): contrato da tela de cadastro`

### Review Findings

- **[Review][Patch]** `cadastrar()` checava duplicidade e gravava em duas operações separadas, sem
  atomicidade. Dois cadastros simultâneos do mesmo e-mail faziam o perdedor violar
  `uk_usuarios_email` e cair no handler genérico como `500 ERRO_INTERNO`, contra a AC2. `save` virou
  `saveAndFlush` dentro de `try/catch DataIntegrityViolationException` que relança
  `EmailJaCadastradoException`. Coberto por `CadastroConcorrenciaEmailTest` (Testcontainers, duas
  threads), verificado que falha sem o catch.
- **[Review][Patch]** `CadastroRequest` não tinha limite superior: campo maior que a coluna
  `VARCHAR(255)` estourava no INSERT como 500 em vez do 400 da AC4. `@Size(max = 255)` em `nome` e
  `email`; `max = 72` em `senha`, o teto do BCrypt.
- **[Review][Patch]** Nenhum teste persistia um `Usuario` de verdade — apagar o `createdAt` do
  construtor deixava a suíte verde e quebrava todo cadastro real. Round-trip adicionado em
  `UsuarioRepositorySmokeTest`, verificado que só ele pega essa regressão.
- **[Review][Patch]** A allow-list pública estava enumerada em `README.md` (tabela de endpoints e
  seção de segurança) e `docs/regras-de-negocio.md` sem a rota nova. Os três atualizados.
- **[Review][Patch]** Validação client-side não aparava espaços (senha de seis espaços passava e
  voltava 400), e `nome` era persistido com o padding. `trim()` no `AuthService` e no
  `erroDePreenchimento` — no vazio, que espelha o `@NotBlank`; o mínimo de 6 continua medido no
  texto cru, como o `@Size(min = 6)`, porque a senha viaja sem ser aparada.
- **[Review][Patch]** Campos sem `autoComplete` nem `required`. Adicionados `name`/`email`/
  `new-password`; `TextField` já repassava os atributos, não precisou mudar.
- **[Review][Patch]** `AuthSecurityTest` aferia só o cadastro, deixando uma edição futura derrubar
  `/api/auth/login` do mesmo matcher com a suíte verde. Asserção do login acrescentada.
- **[Review][Patch]** Asserção tautológica no teste do 409 (`senhaHash` nunca poderia estar no DTO
  de resposta) trocada pela que a AC2 teme de fato: o corpo ecoando o e-mail submetido. Removido o
  `org.hamcrest.Matchers.containsString` qualificado onde já havia static import.
- **[Review][Defer]** Não corrigidos por exigirem tocar `LoginPage.tsx` (que o usuário determinou
  intocada) ou abrir escopo que nenhuma AC pede: duplicação do letreiro de marquee entre as duas
  telas, `rotaPorPapel` morando em `LoginPage.tsx` em vez de `lib/sessao.ts`, ausência de teste de
  roteamento no nível do `App`, e falta de rate limit no cadastro público.

## Dev Notes

**Escopo da mudança em relação à story original.** Esta story foi renomeada de "Autocadastro de Cliente" (papel `CLIENTE` fixo, back-end rejeitava qualquer outro papel) pra "Cadastro de Usuário" (papel selecionável) via `bmad-correct-course` em 2026-08-13. Ver `docs/decisions.md` — "Story 1.3 vira 'Cadastro de Usuário' com papel selecionável, não só autocadastro de cliente" — pro racional completo. **Nada da Story 1.3 está implementado em `main`/no branch atual**; não há código anterior desta story pra preservar ou migrar.

**Auto-registro é aberto, de propósito.** Qualquer visitante escolhe qualquer um dos 3 papéis sem precisar estar autenticado como outro papel — não há gate de autorização (tipo "só ORGANIZADOR cria PORTARIA"). Isso é uma decisão deliberada, tomada no correct-course, pra reduzir atrito de avaliação/teste do desafio (evita depender só de contas de seed pra testar organizador/portaria). **Não "corrija" isso adicionando autorização** — seria contradizer a AC1, que não tem nenhuma condição de quem está fazendo a requisição.

**Onde o enum `Papel` entra — e onde não entra.** `Papel` existe só como tipo do campo `CadastroRequest.papel`, pra validação e clareza no contrato da API. `Usuario.papel` continua `String` (coluna `usuarios.papel VARCHAR(20)`, sem mudança de schema — ver migration abaixo). Ao persistir, converte com `papel.name()`. Não propague `Papel` pra `JwtService`, `JwtAuthenticationFilter`, `LoginResponse` ou `SecurityConfig` — todos operam em `String` hoje e não há necessidade desta story de mudar isso; seria refactor fora do escopo das ACs.

**Os dois casos de `papel` inválido (AC3) já têm handler — não crie exceção nova.** `GlobalExceptionHandler` já tem `@ExceptionHandler(MethodArgumentNotValidException.class)` (400 `PARAMETRO_INVALIDO`, mensagem por campo — cobre `papel` ausente/nulo via `@NotNull`) e `@ExceptionHandler(HttpMessageNotReadableException.class)` (400 `CORPO_INVALIDO` — cobre `papel` com valor fora do enum, que falha na desserialização Jackson antes mesmo do Bean Validation rodar). `CadastroRequest.papel: Papel` tipado como enum já aciona os dois caminhos corretamente sem código extra.

**Migration: nenhuma nova.** `V1__schema.sql` já tem `papel VARCHAR(20) NOT NULL CHECK (papel IN ('ORGANIZADOR', 'CLIENTE', 'PORTARIA'))` — a constraint de banco já aceita os 3 papéis desde a Story 1.1. Esta story é só camada de aplicação.

**Autologin.** Mesmo formato de resposta do login: `POST /api/auth/cadastro` retorna `LoginResponse(token, papel)` (200), reaproveitando `JwtService.generateToken(email, papel)` e o `PasswordEncoder` (BCrypt) já injetados em `AuthService`. Isso evita uma segunda requisição de login logo após o cadastro.

**Placeholder existente no front.** `App.tsx` já tem uma rota `/cadastro` registrada, hoje apontando pra `<PapelPlaceholderPage titulo="Ficha nova" mensagem="O autocadastro de cliente chega na Story 1.3. Por enquanto, as contas vêm do seed." />`. Substitua o `element`, não crie uma rota nova.

**Erro de e-mail duplicado não vaza informação (AC2).** Mesma disciplina de `login()`: a mensagem de erro não distingue "e-mail não existe" de "e-mail existe mas outra coisa falhou" — só existe um caminho de 409 (`EMAIL_JA_CADASTRADO`), sem hint adicional no corpo.

**Convenção de commit.** Um commit por task, na ordem RED → GREEN → REFACTOR → COMMIT. Mensagens em conventional commits (`feat(auth): ...`, `test(web): ...`), corpo curto (1-3 linhas) explicando o quê e o porquê — a mensagem descreve a mudança, não o processo em volta dela (convenção fixada nas instruções do projeto, seção "Engenharia e processo"). As mensagens sugeridas em cada task são ponto de partida, não texto obrigatório literal.

### Project Structure Notes

**Novos:**
- `api/src/main/java/br/com/rolo35/api/auth/Papel.java`
- `api/src/main/java/br/com/rolo35/api/auth/EmailJaCadastradoException.java`
- `api/src/main/java/br/com/rolo35/api/auth/dto/CadastroRequest.java`
- `web/src/pages/CadastroPage.tsx`
- `web/src/pages/CadastroPage.test.tsx`

**Modificados — leitura obrigatória antes de codar (não são scaffolding vazio, têm comportamento existente a preservar):**
- `api/src/main/java/br/com/rolo35/api/auth/Usuario.java` — entidade JPA atual, só `@NoArgsConstructor`; adicionar construtor de registro sem tocar nos campos/anotações existentes.
- `api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java` — hoje só `login()`; preservar a lógica de mitigação de timing (`DUMMY_HASH`) e a normalização de e-mail já existentes, sem duplicar sem necessidade.
- `api/src/main/java/br/com/rolo35/api/auth/controller/AuthController.java` — hoje só `POST /login`.
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` — ~25 handlers hoje, um por tipo de exceção, tudo num arquivo só; adicionar o de `EmailJaCadastradoException` seguindo o padrão exato dos vizinhos (sem criar handler class nova).
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` — lista `permitAll()` é sensível à ordem quando há wildcard envolvido; `/api/auth/cadastro` é path exato, sem esse risco, mas confira o matcher list inteiro antes de mexer.
- `web/src/api/auth.ts` — hoje só exporta `Papel`, `LoginResponse`, `login()`.
- `web/src/App.tsx` — troca só o `element` da rota `/cadastro` existente.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Cadastro de Usuário] — ACs canônicas desta story, já ampliadas pelo correct-course.
- [Source: docs/decisions.md#Story 1.3 vira "Cadastro de Usuário" com papel selecionável, não só autocadastro de cliente] — racional da mudança de escopo.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md linha 219] — schema `usuarios(id, nome, email, senha_hash, papel, created_at)`, tabela única pros 3 papéis.
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#FR-1: Login e papel fixo por conta] — "três papéis fixos por conta, sem acúmulo" — a mudança desta story cabe dentro dessa regra.
- [Source: api/src/main/resources/db/migration/V1__schema.sql] — constraint `CHECK (papel IN ('ORGANIZADOR', 'CLIENTE', 'PORTARIA'))` já cobre os 3 papéis.
- [Source: _bmad-output/implementation-artifacts/1-1-fundacao-e-login-com-papel-fixo.md] — padrões de `AuthService`/`SecurityConfig`/`JwtService` estabelecidos nesta story, reaproveitados aqui.
- [Source: instruções do projeto — Metodologia XP + TDD] — regra de teste nasce antes do código; exceção documentada pra teste de UI (escrito depois do componente).
- [Source: instruções do projeto — convenção de commits] — commits em conventional commits, um por task, descrevendo a mudança.

## Dev Agent Record

### Agent Model Used

Claude Opus 5

### Debug Log References

RED confirmado antes de cada GREEN:

- Task 1 — `CadastroRequestValidationTest` não compilava (`CadastroRequest cannot be resolved`).
- Task 4 — `AuthServiceTest`: 13 erros, `The method cadastrar(CadastroRequest) is undefined for the
  type AuthService`.
- Task 5 — `AuthControllerTest`: 10 falhas (rota inexistente, tudo caindo no handler genérico).
- Task 6 — `AuthSecurityTest.cadastroReturns200WithoutToken`: `Status expected:<200> but was:<401>`,
  que é exatamente a confirmação que a task pede (sem `permitAll()`, a rota cai em `NAO_AUTENTICADO`
  por `anyRequest().authenticated()`).

Um caso da Task 5 nasceu errado e foi corrigido: `"ORGANIZADOR "` (com espaço à direita) estava na
lista de papéis "fora do conjunto" esperando 400, mas o Jackson apara espaços antes de resolver o
enum e devolveu 200. O valor não é um papel inválido, é o papel válido com padding — trocado por
`"ADMIN"`/`"PORTEIRO"`/`"cliente"`, que são de fato fora do conjunto (a desserialização é
case-sensitive).

### Completion Notes List

- **Front sem aceite de termos e com layout fixado pelo usuário.** A Task 8 da spec pedia campo de
  "aceite" e descrevia o shell só por herança do `LoginPage`; o usuário cortou o aceite e ditou a
  especificação visual completa (marca de marquee, card com sombra dura em ciano, régua
  ciano→amarelo→vermelho, seletor de papel em três botões com `aria-pressed`, botão "CRIAR FICHA",
  link "◂ já tenho ficha, quero entrar"). O autologin da spec foi mantido: o sucesso grava a sessão
  e navega por `rotaPorPapel`, sem passar pela tela de login.
- **`AuthSecurityTest` é arquivo novo, fora da lista da spec.** A Task 6 manda confirmar que sem o
  `permitAll()` a rota cairia em 401, e `AuthControllerTest` roda com `addFilters = false` — não
  enxerga a filter chain. Sem esse teste a confirmação seria manual e não ficaria protegida contra
  regressão. Mesmo padrão dos `*SecurityTest` já existentes.
- **Validação client-side: duas mensagens, não três.** A especificação visual do usuário enumerou as
  validações "na ordem" e listou só campos vazios e senha curta. A checagem de "e-mail com `@`" que
  a Task 8 da spec citava ficou de fora do front — o back-end já reprova com `@Email` e a mensagem
  nomeia o campo (AC4), e o `Alert` exibe. Papel obrigatório foi mantido (a spec exige escolha
  explícita, e a Task 10 exige que submeter sem papel não chame a API), com mensagem própria depois
  das duas ditadas, preservando a ordem pedida.
- **Marca de marquee duplicada entre `LoginPage` e `CadastroPage`.** As ~18 linhas do letreiro
  aparecem nas duas telas. A extração pra componente chegou a ser feita e foi desfeita: o usuário
  determinou que `LoginPage.tsx` ficasse intocada, e um componente compartilhado com um consumidor
  só não compartilha nada. Candidato natural a extrair quando `LoginPage` puder ser tocada.
- **`papel.name()` é a única fronteira do enum.** `Papel` não atravessa pra `Usuario`, `JwtService`,
  `LoginResponse` nem `SecurityConfig`, como as Dev Notes exigem. Nenhuma migration nova.
- **Normalização de e-mail extraída (REFACTOR da Task 4).** `login()` e `cadastrar()` compartilham
  `normalizarEmail()`; normalizar só numa ponta faria a conta recém-criada não ser achada pela
  outra, e deixaria passar o mesmo e-mail em outra caixa na checagem de duplicidade.
- **`PapelPlaceholderPage` continua importada** em `App.tsx`: a rota `/em-construcao` ainda usa.
- Suítes completas verdes: back-end `mvn test` (300 testes) e front `npm test` (160 testes),
  mais `npx tsc --noEmit`, `npm run lint` (só os 2 avisos de fast-refresh pré-existentes) e
  `npm run build`.
- **Rodada de code review aplicada** (ver Review Findings): 8 patches, um commit por bloco temático.
  Os dois achados críticos — a corrida de e-mail duplicado virando 500 e a falta de teto nos campos
  — foram fechados com testes que provei falharem sem a correção, não só com testes que passam
  depois dela.
- **`sprint-status.yaml` estava com YAML inválido desde antes desta story**: o valor de
  `last_updated` traz `Epic 5 fechado:` sem aspas, e `:` seguido de espaço abre mapping. O arquivo
  não era carregável por parser nenhum. Como a linha já ia ser editada por esta story, o valor foi
  posto entre aspas simples — o conteúdo é o mesmo, e agora o arquivo parseia.

### File List

- `api/src/main/java/br/com/rolo35/api/auth/Papel.java`
- `api/src/main/java/br/com/rolo35/api/auth/EmailJaCadastradoException.java`
- `api/src/main/java/br/com/rolo35/api/auth/dto/CadastroRequest.java`
- `api/src/main/java/br/com/rolo35/api/auth/Usuario.java` (update — construtor de registro)
- `api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java` (update — `cadastrar()`,
  `normalizarEmail()` extraída)
- `api/src/main/java/br/com/rolo35/api/auth/controller/AuthController.java` (update —
  `POST /api/auth/cadastro`)
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update — handler de
  `EmailJaCadastradoException`)
- `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java` (update — `permitAll()` da rota)
- `api/src/test/java/br/com/rolo35/api/auth/dto/CadastroRequestValidationTest.java`
- `api/src/test/java/br/com/rolo35/api/auth/AuthSecurityTest.java`
- `api/src/test/java/br/com/rolo35/api/auth/CadastroConcorrenciaEmailTest.java`
- `api/src/test/java/br/com/rolo35/api/auth/AuthControllerTest.java` (update — cadastro)
- `api/src/test/java/br/com/rolo35/api/auth/service/AuthServiceTest.java` (update — cadastro)
- `api/src/test/java/br/com/rolo35/api/auth/UsuarioRepositorySmokeTest.java` (update — round-trip do
  construtor de registro)
- `web/src/api/auth.ts` (update — `cadastrar()`)
- `web/src/pages/CadastroPage.tsx`
- `web/src/pages/CadastroPage.test.tsx`
- `web/src/App.tsx` (update — rota `/cadastro` real)
- `README.md` (update — tabela de endpoints e allow-list pública)
- `docs/regras-de-negocio.md` (update — allow-list pública)
- `_bmad-output/planning-artifacts/epics.md` (update — "aceite dos termos" removido da AC1)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (update)

## Suggested Review Order

**Criação da conta — o coração da mudança**

- Ponto de entrada: a dupla checagem de e-mail e por que nenhuma das duas sobra.
  [`AuthService.java:75`](../../api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java#L75)

- `saveAndFlush` em `try/catch`: com `save`, a violação escaparia do catch e viraria 500.
  [`AuthService.java:92`](../../api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java#L92)

- `papel.name()` é a única fronteira do enum; ele não atravessa pra entidade.
  [`AuthService.java:88`](../../api/src/main/java/br/com/rolo35/api/auth/service/AuthService.java#L88)

**Contrato de entrada e validação**

- Limites superiores existem pra transformar estouro de coluna em 400, não 500.
  [`CadastroRequest.java:17`](../../api/src/main/java/br/com/rolo35/api/auth/dto/CadastroRequest.java#L17)

- `max = 72` na senha: acima disso o BCrypt trunca e duas senhas colidem.
  [`CadastroRequest.java:20`](../../api/src/main/java/br/com/rolo35/api/auth/dto/CadastroRequest.java#L20)

- Enum tipado aciona os dois handlers existentes de `papel` inválido, sem código novo.
  [`Papel.java:1`](../../api/src/main/java/br/com/rolo35/api/auth/Papel.java#L1)

**Superfície pública e mapeamento de erro**

- Path exato, não `/api/auth/**`: rota futura de auth não nasce pública por herança.
  [`SecurityConfig.java:54`](../../api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java#L54)

- Endpoint devolve `LoginResponse` pra permitir autologin sem segunda requisição.
  [`AuthController.java:30`](../../api/src/main/java/br/com/rolo35/api/auth/controller/AuthController.java#L30)

- 409 com envelope `{codigo, mensagem}`, no padrão exato dos ~37 handlers vizinhos.
  [`GlobalExceptionHandler.java:57`](../../api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java#L57)

**Persistência**

- `createdAt` carimbado no construtor porque a coluna é `NOT NULL` sem `@CreationTimestamp`.
  [`Usuario.java:44`](../../api/src/main/java/br/com/rolo35/api/auth/Usuario.java#L44)

**Tela de cadastro**

- Validação local espelha cada regra no valor que o servidor de fato mede.
  [`CadastroPage.tsx:34`](../../web/src/pages/CadastroPage.tsx#L34)

- Sucesso grava a sessão e roteia por papel, sem passar pela tela de login.
  [`CadastroPage.tsx:71`](../../web/src/pages/CadastroPage.tsx#L71)

- Cliente de API no mesmo padrão de `login()`, com o tipo do contrato real.
  [`auth.ts:21`](../../web/src/api/auth.ts#L21)

- Rota `/cadastro` deixa de ser placeholder e passa a montar a tela real.
  [`App.tsx:34`](../../web/src/App.tsx#L34)

**Testes que provam o que os outros não veem**

- Corrida real via Testcontainers: sem o catch, o perdedor levava 500.
  [`CadastroConcorrenciaEmailTest.java:34`](../../api/src/test/java/br/com/rolo35/api/auth/CadastroConcorrenciaEmailTest.java#L34)

- Round-trip contra o schema: mock de repositório não vê constraint nenhuma.
  [`UsuarioRepositorySmokeTest.java:14`](../../api/src/test/java/br/com/rolo35/api/auth/UsuarioRepositorySmokeTest.java#L14)

- Filter chain de verdade — `AuthControllerTest` roda com `addFilters = false`.
  [`AuthSecurityTest.java:30`](../../api/src/test/java/br/com/rolo35/api/auth/AuthSecurityTest.java#L30)
