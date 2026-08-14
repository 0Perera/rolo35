---
baseline_commit: 9780338
---

# Story 1.3: Cadastro de Usuário

Status: ready-for-dev

<!-- Nota: validação é opcional. Rode validate-create-story pra uma checagem de qualidade antes de dev-story. -->

## Story

As a visitante sem conta,
I want criar minha própria conta escolhendo o papel (ORGANIZADOR, CLIENTE ou PORTARIA),
so that eu consiga operar no sistema com o papel certo sem depender de um cadastro feito manualmente por outra pessoa — inclusive pra avaliação/teste do sistema.

## Acceptance Criteria

1. Given nome/e-mail/senha/papel/aceite dos termos válidos (papel dentre `ORGANIZADOR`, `CLIENTE`, `PORTARIA`) e e-mail ainda não usado — When submete — Then uma conta com o papel informado é criada, senha armazenada com hash (nunca em texto puro), e o fluxo segue pro login (ou já retorna token, a critério da implementação).
2. Given um cadastro com e-mail já existente — When submetido — Then retorna erro claro via envelope `{codigo, mensagem}`, sem confirmar/negar implicitamente se o e-mail pertence a outra conta de forma que vaze dado sensível.
3. Given o endpoint de cadastro chamado com `papel` ausente ou fora do conjunto `{ORGANIZADOR, CLIENTE, PORTARIA}` — When submetido — Then validação de campo rejeita antes de tocar o banco, sem criar conta.
4. Given senha ou e-mail em formato inválido — When submetido — Then validação de campo (`@Valid`) rejeita antes de tocar o banco, com mensagem de erro por campo.

## Tasks / Subtasks

- [ ] **Task 1 — `Papel` enum + `CadastroRequest` DTO (AC: 1, 3, 4)**
  - [ ] **[RED]** `CadastroRequestValidationTest` (ou seção equivalente em teste de validação de bean): `papel` nulo falha `@NotNull`; `nome`/`email`/`senha` em branco falham `@NotBlank`; `email` mal formatado falha `@Email`; `senha` com menos de 6 chars falha `@Size(min=6)`
  - [ ] **[GREEN]** Cria `auth/Papel.java`: `public enum Papel { ORGANIZADOR, CLIENTE, PORTARIA }`
  - [ ] **[GREEN]** Cria `auth/dto/CadastroRequest.java`: `record CadastroRequest(@NotBlank String nome, @NotBlank @Email String email, @NotBlank @Size(min = 6) String senha, @NotNull Papel papel) {}`
  - [ ] Commit: `feat(auth): enum Papel e CadastroRequest com papel selecionável (Story 1.3)`

- [ ] **Task 2 — Erro de e-mail duplicado (AC: 2)**
  - [ ] **[RED]** Teste (unit, ver Task 4) esperando `EmailJaCadastradoException` quando `findByEmail` retorna usuário existente
  - [ ] **[GREEN]** Cria `auth/EmailJaCadastradoException.java` (mesmo padrão de `CredenciaisInvalidasException`: `RuntimeException`, sem argumentos, mensagem fixa "E-mail já cadastrado")
  - [ ] **[GREEN]** Adiciona handler em `GlobalExceptionHandler`: `@ExceptionHandler(EmailJaCadastradoException.class)` → `409 CONFLICT`, `ApiError("EMAIL_JA_CADASTRADO", "E-mail já cadastrado")`
  - [ ] Commit: `feat(auth): erro 409 pra e-mail já cadastrado`

- [ ] **Task 3 — Construtor de registro em `Usuario` (AC: 1)**
  - [ ] **[GREEN]** Adiciona `Usuario(String nome, String email, String senhaHash, String papel)` em `Usuario.java`, setando `createdAt = Instant.now()` (mesmo padrão do branch de referência — ver Dev Notes). Não mexe no construtor/campos existentes.
  - [ ] Commit: `feat(auth): construtor de registro em Usuario`

- [ ] **Task 4 — `AuthService.cadastrar(CadastroRequest)` (AC: 1, 2)**
  - [ ] **[RED]** `AuthServiceTest`: `cadastrarCriaUsuarioComPapelInformadoERetornaToken` parametrizado pelos 3 papéis (`ArgumentCaptor<Usuario>` confirma `papel` salvo = `papel.name()` do request); `cadastrarLancaEmailJaCadastradoQuandoEmailExiste` (verifica `repository.save` nunca chamado)
  - [ ] **[GREEN]** Implementa `cadastrar()` em `AuthService`: normaliza e-mail (`trim().toLowerCase(Locale.ROOT)`, mesmo padrão de `login()`), `findByEmail` → lança `EmailJaCadastradoException` se presente; senão `passwordEncoder.encode(senha)`, monta `Usuario` com `papel.name()`, `repository.save(...)`, gera JWT via `jwtService.generateToken(email, papel)` (assinatura já existente), retorna `new LoginResponse(token, papel)`
  - [ ] **[REFACTOR]** Confere que `login()` e `cadastrar()` não duplicam a normalização de e-mail sem necessidade (extrair só se ficar repetitivo, sem exagerar)
  - [ ] Commit: `feat(auth): AuthService.cadastrar cria conta com o papel informado`

- [ ] **Task 5 — `POST /api/auth/cadastro` (AC: 1, 2, 3, 4)**
  - [ ] **[RED]** `AuthControllerTest`: 200 com token pra cada um dos 3 papéis; 409 `EMAIL_JA_CADASTRADO` em duplicidade; 400 `PARAMETRO_INVALIDO` com `papel` ausente; 400 `CORPO_INVALIDO` com `papel` fora do conjunto (string inválida — deserialização de enum falha, cai no handler genérico de `HttpMessageNotReadableException` já existente); 400 `PARAMETRO_INVALIDO` com e-mail/senha mal formatados
  - [ ] **[GREEN]** Adiciona `@PostMapping("/cadastro")` em `AuthController`, delega pra `authService.cadastrar(request)`
  - [ ] Commit: `feat(auth): endpoint POST /api/auth/cadastro (AC1-4)`

- [ ] **Task 6 — Libera a rota no filtro de segurança (AC: 1)**
  - [ ] **[GREEN]** Adiciona `/api/auth/cadastro` ao mesmo grupo `permitAll()` de `/api/auth/login` em `SecurityConfig`
  - [ ] Confirma (reexecutando os testes da Task 5) que sem essa liberação a rota cairia em `401 NAO_AUTENTICADO` por padrão
  - [ ] Commit: `feat(auth): libera /api/auth/cadastro no filtro de segurança`

- [ ] **Task 7 — Cliente de API no front (AC: 1, 2, 3, 4)**
  - [ ] **[GREEN]** Adiciona em `web/src/api/auth.ts`: `cadastrar(nome: string, email: string, senha: string, papel: Papel): Promise<LoginResponse>` → `POST /api/auth/cadastro`, mesmo padrão de `login()`
  - [ ] Commit: `feat(web): cliente de API pra cadastro de usuário`

- [ ] **Task 8 — Tela de cadastro com seleção de papel (AC: 1, 3, 4)**
  - [ ] **[GREEN]** Cria `web/src/pages/CadastroPage.tsx`: mesmo shell de `LoginPage.tsx` (`PageShell variant="auth"`, `Card`, `TextField`, `Alert`, `Button`), campos nome/email/senha/aceite + seletor de papel (as 3 opções, sem pré-seleção — força escolha explícita); validação client-side espelhando as regras do back (senha ≥ 6, e-mail com `@`, papel obrigatório); ao sucesso grava `rolo35.token`/`rolo35.papel` em `localStorage` e navega via `rotaPorPapel` (importado de `LoginPage.tsx`); erro do back exibido via `Alert` (mesmo padrão de tratamento de `ApiRequestError` de `LoginPage.tsx`)
  - [ ] Commit: `feat(web): tela de cadastro com seleção de papel`

- [ ] **Task 9 — Liga a rota real (AC: 1)**
  - [ ] **[GREEN]** Em `App.tsx`, troca o `<Route path="/cadastro" element={<PapelPlaceholderPage .../>} />` (placeholder atual, que menciona "autocadastro de cliente... Story 1.3") pelo `<CadastroPage />` real; remove o import de `PapelPlaceholderPage` se não sobrar nenhum outro uso
  - [ ] Commit: `feat(web): liga a rota /cadastro na tela real`

- [ ] **Task 10 — Contrato da tela de cadastro (AC: 1, 2, 3, 4)**
  - [ ] Escrito depois do componente pronto, por convenção do projeto (cobertura leve de interação visual, focada em contrato de comportamento — instruções do projeto, tabela de tipos de teste)
  - [ ] `web/src/pages/CadastroPage.test.tsx` (Vitest + Testing Library + `userEvent`, `MemoryRouter`): submete com os 3 papéis e confirma `cadastrar` chamado com os argumentos certos e navegação por `rotaPorPapel`; erro do back (mock rejeitando com `ApiRequestError`) aparece via `screen.findByRole('alert')`; tentar submeter sem escolher papel não chama a API
  - [ ] Commit: `test(web): contrato da tela de cadastro`

### Review Findings

<!-- Preenchido depois do code review, no formato [Review][Patch]/[Review][Defer] — vazio até lá. -->

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

### Debug Log References

### Completion Notes List

### File List
