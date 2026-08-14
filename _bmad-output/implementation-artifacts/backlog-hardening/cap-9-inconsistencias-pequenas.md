# Pseudo-story CAP-9: Fechar inconsistências pequenas já sinalizadas

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-9, Grupo B)

> ⚠️ **Dependência**: o sub-item de índice em `organizador_id` só deve ser feito **depois** do
> CAP-1 estar commitado — a forma final de `findByOrganizadorId` pode mudar com a remoção do
> isolamento entre organizadores.

## Story

As mantenedor do código,
I want fechar 5 inconsistências pequenas já apontadas em code reviews anteriores,
so that o código para de carregar dívida técnica de baixo custo que já foi identificada e nunca
corrigida.

## Sub-itens (cada um é uma task independente — podem ser feitos em qualquer ordem entre si)

### Task 1 — `StatusAssento` como tipo real do campo persistido

- [ ] **[RED]** Teste em `AssentoSessaoTest`/`SessaoServiceTest` provando que `status` é do tipo
  `StatusAssento` (compile-time), não `String` — vai falhar como erro de compilação até o `GREEN`,
  não como teste que roda e falha (é uma migração de tipo).
- [ ] **[GREEN]** Trocar `AssentoSessao.status` de `String` pra `StatusAssento`. Ajustar
  `SessaoService` (remover `STATUS_LIVRE`/`STATUS_RESERVADO` como constantes String) e
  `ReservaService.statusEfetivoLivre()` (trocar `.name().equals(String)` por comparação direta de
  enum). Ajustar mapeamento JPA (`@Enumerated(EnumType.STRING)`) e conferir que bate com o `CHECK`
  constraint do banco (`V1__schema.sql`).
- [ ] Rodar toda a suíte de `sessoes`/`reservas` — é a mudança com maior raio de efeito deste
  grupo, checar com atenção.
- [ ] Commit: `refactor(sessoes): StatusAssento vira o tipo real do campo persistido`

### Task 2 — Unificar Jackson

- [ ] Trocar em `TmdbClient.java` o import `com.fasterxml.jackson.annotation.JsonProperty` pelo
  equivalente Jackson 3 (`tools.jackson.annotation.JsonProperty` ou o que for o padrão do Spring
  Boot 4 em uso no restante do projeto — conferir versão exata antes de trocar).
- [ ] Rodar teste de `TmdbClient` (mock de resposta) pra confirmar que a serialização continua
  funcionando com a anotação nova.
- [ ] Commit: `fix(sessoes): unifica TmdbClient na mesma geração de Jackson do resto do projeto`

### Task 3 — Dropar índice redundante

- [ ] Criar migration nova: `DROP INDEX idx_sessoes_sala_id;` (redundante desde a V3, que criou
  `idx_sessoes_sala_id_data_hora`, do qual o índice antigo é prefixo).
- [ ] Commit: `chore(sessoes): remove índice redundante idx_sessoes_sala_id`

### Task 4 — Índice em `sessoes.organizador_id` (só depois do CAP-1)

- [ ] Confirmar como `findByOrganizadorId`/rota de gestão ficou depois do CAP-1 — se o filtro por
  dono foi removido, avaliar se esse índice ainda faz sentido (pode ter deixado de ser necessário).
- [ ] Se ainda fizer sentido: migration `CREATE INDEX idx_sessoes_organizador_id ON sessoes
  (organizador_id);`.
- [ ] Commit: `chore(sessoes): adiciona índice em organizador_id` (ou pular esta task inteira se o
  CAP-1 tiver eliminado a necessidade — documentar a decisão em vez de criar índice morto).

### Task 5 — `saveAll()` em `PagamentoService.confirmar()`

- [ ] **Se já foi feito como bônus do CAP-3**, pular esta task (evitar trabalho duplicado —
  conferir `cap-3-backstops-banco-ingressos.md` antes de começar).
- [ ] Caso contrário: trocar `assentoIds.stream().map(id -> ingressoRepository.save(...))` por
  `ingressoRepository.saveAll(...)`, consistente com `reivindicarVendido()`/`liberar()`.
- [ ] Commit: `refactor(pagamentos): usa saveAll() na emissão de ingressos`

## Dev Notes

- Estas 5 tasks são independentes entre si — dá pra fazer só algumas se o tempo apertar, sem
  quebrar as outras.
- Task 1 é a de maior risco (muda tipo de campo persistido) — se o tempo for curto, priorizar as
  Tasks 2/3/5 (baixo risco, baixo custo) antes dela.
