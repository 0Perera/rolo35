---
title: 'Contas de demonstração na tela de login'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '347d2a63eda7adec6d60326856ba65814f5e8232'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entregue como teste técnico, o projeto exige que quem avalia entre nos três papéis sem
criar cadastro. As credenciais semeadas só existem no README — a tela de login não dá atalho nenhum.

**Approach:** Bloco recolhido no fim do card de login, abaixo de "CRIAR MINHA FICHA", que abre a
lista das três contas semeadas. Clicar preenche e-mail e senha — não loga — e guarda o destino
pós-login numa variável exclusiva de roteamento, separada do canal `retomarEm` de compra pendente.

## Boundaries & Constraints

**Always:**
- Credenciais exatas de `V2__seed.sql`: `cliente1@rolo35.com.br`/`cliente123`,
  `organizador@rolo35.com.br`/`organizador123`, `portaria@rolo35.com.br`/`portaria123`.
- Clique só preenche; entrar continua sendo ação explícita no botão ENTRAR.
- Destino da conta demo em variável própria, nunca no `state.retomarEm` — reusar aquele canal faria a
  escolha de uma conta demo parecer compra interrompida.
- Handoff: VT323 (`font-mono`), bordas 2px `#171219`, separador tracejado `#C7B694`.
- `aria-expanded` no gatilho; seta decorativa (`aria-hidden`).

**Ask First:** mudar migration, seed ou tabela de credenciais do README; logar automático no clique
(já descartado).

**Never:** tocar em back-end, migration ou `V2__seed.sql`; alterar a retomada de compra existente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fechado (padrão) | Login recém-aberto | Só a linha "Contas de demonstração" + seta ▾, `aria-expanded="false"`, nenhum botão de conta no DOM | N/A |
| Abrir | Clique no gatilho | 3 contas visíveis, seta ▴, `aria-expanded="true"` | N/A |
| Escolher conta | Painel aberto, clique em ORGANIZADOR | Campos preenchidos com o par semeado; `login()` não é chamado | N/A |
| Entrar por demo | Conta PORTARIA preenchida + ENTRAR | Sessão salva, navega pra `/portaria` | 401/rede caem no `Alert` atual |
| Demo com compra pendente | State tem `retomarEm`; escolhe CLIENTE e entra | Vai pra `/` (destino do papel), não pro mapa | N/A |
| Compra pendente sem demo | State tem `retomarEm`, credencial digitada, papel CLIENTE | Volta ao mapa levando `assentoIds` — inalterado | N/A |
| Editar após escolher | Conta clicada, usuário altera e-mail | Destino demo descartado; roteamento volta ao normal | N/A |

</frozen-after-approval>

## Code Map

- `web/src/pages/LoginPage.tsx` -- único arquivo de produção. `rotaPorPapel` (L14-23) já devolve
  `/organizador`, `/` e `/portaria`; `retomada` (L26-40) é o canal de compra pendente que **não**
  pode ser reusado; `handleSubmit` (L42-62) decide o destino; o `<Link to="/cadastro">` (L120-122)
  fecha o card — o bloco entra logo abaixo dele.
- `web/src/pages/LoginPage.test.tsx` -- testes de retomada (L68-116) não podem regredir. Padrão:
  `vi.spyOn(authApi, 'login').mockResolvedValue(...)` + `MemoryRouter` com `initialEntries`.
- `api/src/main/resources/db/migration/V2__seed.sql` (L4-8) -- **só leitura**: e-mails. Senhas em
  claro no `README.md` (L217-222).
- `web/src/index.css` (L3-32) -- tokens: `ink-950` `#171219`, `paper-100` `#F4E9D4`, `flame-600`
  `#E32B21`, `flame-400` `#FFC414`, `cyan-400` `#7ED9F2`, `font-mono` VT323. `#C7B694`, `#6D655B`,
  `#FFF3D0`, `#E7DDCB` não são tokens — literal, como em `PagamentoPage.tsx:418` e
  `MeusIngressosPage.tsx:46`.
- `web/src/components/SeletorDeOpcao.tsx` (L102-116) -- padrão de gatilho recolhível com
  `aria-expanded`; é um listbox de formulário, copiar só o padrão, não reusar.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/pages/LoginPage.tsx` -- constante de módulo com as três contas (e-mail, senha, papel,
      rótulo, cor da etiqueta) -- dado fixo, fora do componente.
- [x] `web/src/pages/LoginPage.tsx` -- estados `aberto` e `destinoDemo` (`string | null`, só
      roteamento); limpar `destinoDemo` quando e-mail ou senha mudam à mão.
- [x] `web/src/pages/LoginPage.tsx` -- renderizar o bloco após o `<Link to="/cadastro">`, dentro do
      `Card`, com separador tracejado e tipografia do handoff.
- [x] `web/src/pages/LoginPage.tsx` -- em `handleSubmit`, checar `destinoDemo` antes do ramo de
      `retomada`, comentando por que os canais são separados.
- [x] `web/src/pages/LoginPage.test.tsx` -- cobrir a matriz inteira.

**Acceptance Criteria:**
- Given o login recém-aberto, when nada é clicado, then o formulário fica idêntico ao de hoje, com o
  recurso reduzido a uma linha.
- Given o painel aberto, when se navega por teclado, then gatilho e contas respondem a Tab e
  Enter/Espaço com o anel de foco ciano global.
- Given qualquer conta demo, when se entra com ela, then chega na tela do próprio papel.

## Design Notes

O aviso "Entre para confirmar seus assentos…" citado na intenção **não existe neste repositório**
(zero ocorrências em `web/src`). O risco é real assim mesmo: escrever em `retomarEm` no clique faria
o login tratar a escolha como compra interrompida e mandar o CLIENTE pro mapa. Daí a variável própria
e a ordem da checagem:

```tsx
if (destinoDemo) {
  navigate(destinoDemo);   // conta demo: sempre a tela do papel
  return;
}
if (retomada && resposta.papel === 'CLIENTE') { /* compra pendente, inalterado */ }
```

Sem flag booleana separada de pendência: nenhum componente consome esse sinal hoje, seria código
morto. `retomada` já nasce vazia quando se chega pelo cabeçalho — o link não envia `state`.

Medidas: separador `mt-[14px] border-t-2 border-dashed border-[#C7B694] pt-[14px]`; gatilho
`flex w-full justify-between` com `font-mono text-lg text-[#6D655B] hover:text-flame-600` e seta
`text-flame-600`; lista `flex flex-col gap-2`; conta `border-2 border-ink-950 bg-paper-100
hover:bg-[#FFF3D0] px-3 py-2.5` com e-mail `font-mono text-[17px]` e etiqueta `text-[10px]
font-extrabold tracking-[1.2px] px-2 py-[3px] border-2 border-ink-950` — fundo `#FFC414` (CLIENTE),
`#7ED9F2` (ORGANIZADOR), `#E7DDCB` (PORTARIA).

## Verification

**Commands:**
- `npm test --prefix web` -- expected: suíte verde, com os testes novos de `LoginPage`
- `npm run lint --prefix web` -- expected: zero erro
- `npm run build --prefix web` -- expected: `tsc -b` sem erro de tipo

**Resultado (2026-08-14):** `vitest run` verde (22 arquivos, 179 testes, 10 em `LoginPage`); `oxlint`
sem erro (só o aviso pré-existente de fast-refresh por causa do export `rotaPorPapel`). `tsc -b`
acusa 2 erros em `MeusIngressosPage.tsx` (119, 121) vindos de trabalho concorrente não commitado na
paginação de `listarMeusIngressos` — fora deste spec, nenhum arquivo desta mudança está envolvido.
No Windows, `npm test` falha na sintaxe `NODE_OPTIONS=` do script; rodar `npx vitest run` com a
variável exportada antes.

## Suggested Review Order

**Separação entre rota da conta demo e retomada de compra**

- O ramo novo vem antes da retomada e explica por que os canais não se misturam.
  [`LoginPage.tsx:83`](../../web/src/pages/LoginPage.tsx#L83)

- Variável exclusiva de roteamento — o coração da precaução pedida.
  [`LoginPage.tsx:58`](../../web/src/pages/LoginPage.tsx#L58)

- Editar credencial à mão descarta o destino demo, evitando rota órfã.
  [`LoginPage.tsx:137`](../../web/src/pages/LoginPage.tsx#L137)

**Dados e interação**

- Credenciais do seed em constante de módulo, com a razão de estarem no código.
  [`LoginPage.tsx:44`](../../web/src/pages/LoginPage.tsx#L44)

- Clique preenche e nada mais: entrar segue sendo ação explícita.
  [`LoginPage.tsx:66`](../../web/src/pages/LoginPage.tsx#L66)

**Superfície visual**

- Bloco recolhido no fim do card: separador tracejado, gatilho e lista.
  [`LoginPage.tsx:170`](../../web/src/pages/LoginPage.tsx#L170)

**Testes**

- Fechado por padrão e alternância de `aria-expanded`.
  [`LoginPage.test.tsx:118`](../../web/src/pages/LoginPage.test.tsx#L118)

- Demo vence retomada — a regressão que a precaução existe pra impedir.
  [`LoginPage.test.tsx:183`](../../web/src/pages/LoginPage.test.tsx#L183)

- Destino demo é descartado quando a credencial muda.
  [`LoginPage.test.tsx:208`](../../web/src/pages/LoginPage.test.tsx#L208)
