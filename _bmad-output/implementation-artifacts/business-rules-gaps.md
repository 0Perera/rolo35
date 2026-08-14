# Brechas de Regras de Negócio — Fix List

Achados de revisão adversarial (Edge Case Hunter) contra `epics.md` + stories, procurando
branch de negócio sem AC/handling — não é code review de story já implementada, é auditoria
de especificação. Só o que muda comportamento pro usuário final entra aqui; ruído de
qualidade/cosmético fica em `deferred-work.md`.

Cada item marcado `[ ]` até virar código (ou até virar `[DESCARTADO]` com o motivo).

> **Estado em 2026-08-14:** 11 dos 12 achados fechados. Segue aberto só o
> `[LIMITAÇÃO CONHECIDA]` da rotação do secret HMAC, que é decisão de não
> implementar, não pendência.

## Como usar

- `[FIX]` — solução clara, só falta implementar.
- `[DECISÃO PENDENTE]` — precisa de uma decisão de produto antes de codar (a implementação em si é trivial).
- `[DOCUMENTAR]` — nenhuma mudança de código, só registrar a regra em `docs/decisions.md`/README.
- `[LIMITAÇÃO CONHECIDA]` — decisão de não implementar dado o escopo do desafio; só declarar no README.

---

## Épicos 3, 4, 5 (2026-08-12)

- [x] **[FIX] Reserva não valida sessão com `dataHora` já passada** (FR-10) — resolvido
  `ReservaService.reservar()` agora recusa com `SessaoJaComecouException` (`409 SESSAO_JA_COMECOU`) quando `sessaoRepository.jaComecou(...)` é verdadeiro, checado antes do lock.
  Refs: `_bmad-output/planning-artifacts/epics.md:27`, `api/src/main/java/br/com/rolo35/api/reservas/service/ReservaService.java:68-73`

- [x] **[FIX] Pagamento confirma reserva de sessão já encerrada** (FR-12) — resolvido
  `PagamentoService.confirmar()` agora recusa com o mesmo `SessaoJaComecouException`, checado depois da idempotência e da expiração do hold.
  Refs: `_bmad-output/planning-artifacts/epics.md:29`, `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java:86-92`

- [x] **[DECISÃO PENDENTE] Portaria pode ativar sessão passada ou futura como "ativa pro turno"** (Story 5.1, AC2) — resolvido
  Decisão tomada: janela de -30min/+2h em volta do horário da sessão. `PortariaService.selecionarSessao()` recusa fora dela com `409 SESSAO_FORA_DA_JANELA_DO_TURNO` (`JANELA_TURNO_ANTES_MINUTOS`/`JANELA_TURNO_DEPOIS_HORAS`).
  Refs: `_bmad-output/implementation-artifacts/5-1-selecao-de-sessao-do-turno.md:16`, `api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java:51-52,83-88`

- [x] **[DOCUMENTAR] Precedência não especificada entre "já utilizado" e "evento errado"** (FR-19) — resolvido
  Registrado em `docs/decisions.md`, entrada "Precedência da validação: 'evento errado' vem antes de 'já utilizado' (CAP-10)". A ordem que o código já praticava (sessão checada antes do status) virou decisão declarada, não acidente de implementação.
  Refs: `docs/decisions.md:623`, `_bmad-output/implementation-artifacts/5-2-validacao-de-ingresso-na-portaria.md:45-46`

- [ ] **[LIMITAÇÃO CONHECIDA] Sem estratégia de rotação do secret HMAC** (AD-8)
  Se o secret JWT/HMAC precisar trocar (vazamento/incidente), todo ingresso já emitido — inclusive link público sem expiração (FR-16) — vira `INVALIDO` de uma hora pra outra, sem caminho de migração.
  Fix real (secret versionado + validação dupla durante janela de transição) é complexidade alta, fora do escopo do desafio de 7 dias. Só declarar no README como limitação conhecida.
  Refs: `_bmad-output/planning-artifacts/epics.md:63`

## Fluxo geral, entidades, N+1 e consistência de decisões (2026-08-13)

> Varredura pedida à parte: regra irrelevante/não testável na prática, entidade com falta de informação/integridade, N+1 real no banco, inconsistência entre decisões (`ARCHITECTURE-SPINE.md`) e o que foi de fato implementado.

- [x] **[DOCUMENTAR/REMOVER] AC de FR-19 cita "telefone" que não existe em nenhuma tabela** — resolvido
  As duas ACs foram reescritas pros campos que existem de fato (nome e e-mail), com a menção ao telefone mantida entre parênteses como registro de que a coluna nunca existiu — some a cláusula vácua sem apagar o rastro de por que ela estava ali.
  Refs: `_bmad-output/planning-artifacts/epics.md:630,654`, `api/src/main/resources/db/migration/V1__schema.sql:1-9`

- [x] **[FIX] `ingressos(sessao_id, assento_id)` sem FK composta contra `assento_sessao`** — resolvido
  `V8__backstops_ingressos.sql` adiciona `fk_ingressos_assento_sessao (sessao_id, assento_id) REFERENCES assento_sessao (sessao_id, assento_id)`.
  Refs: `api/src/main/resources/db/migration/V1__schema.sql:54-71`

- [x] **[FIX] Sem `UNIQUE(reserva_id, assento_id)` em `ingressos`** — resolvido
  `V8__backstops_ingressos.sql` adiciona `uq_ingressos_reserva_assento UNIQUE (reserva_id, assento_id)`.
  Refs: `api/src/main/resources/db/migration/V8__backstops_ingressos.sql`

- [x] **[N+1 — checado, não encontrado nas listagens]** `listarPublicadas()`, `findByOrganizadorId()` (`SessaoRepository`) e `buscarPorCliente()` (`IngressoRepository`) já usam `JOIN`/agregação numa query só, sem N+1 real. Único ponto próximo da categoria era `PagamentoService.confirmar()`, que inseria os ingressos aprovados um a um — **também resolvido**: hoje é um `ingressoRepository.saveAll(...)` só, alinhado ao padrão de `reivindicarVendido()`/`liberar()` na mesma classe.
  Refs: `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java:106`

- [x] **[DOCUMENTAR] `AD-11` lista códigos de erro que nunca são usados como erro** — resolvido
  `AD-11` ganhou uma nota "Correção pós-implementação" registrando que `RESERVA_NAO_ATIVA` e `EVENTO_ERRADO` não viraram erro HTTP, e por decisão de quais stories (4.1 e 5.2, ambas devolvendo `200` com o estado no corpo).
  Refs: `_bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md:124`

- [x] **[DOCUMENTAR] Grafo de dependência de `AD-1` não declara `pagamentos → sessoes` nem `ingressos → sessoes`** — resolvido
  A Rule de `AD-1` foi reescrita com a direção explícita (`{pagamentos, ingressos} → reservas → sessoes → auth`, e `A → B` = "A depende de B" dito no próprio texto) e com as dependências de cada domínio nomeadas uma a uma. Fecha junto a ambiguidade de leitura do diagrama que o review adversarial tinha levantado como F1.
  Refs: `_bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md:62`, `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java:21`, `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java`

## UX — visibilidade de ocupação de sala entre organizadores (2026-08-13)

- [x] **[FIX] Organizador não vê ocupação de sala de outros organizadores ao criar/editar sessão** — resolvido
  `FormSessao.tsx` busca a ocupação da sala escolhida (`listarOcupacaoDaSala`) e mostra os intervalos já bloqueados antes do submit, sem dizer de quem é cada sessão. A janela da própria sessão em edição sai da lista — ela não conflita consigo mesma. O conflito de horário deixa de ser descoberto só no `409 SESSAO_CONFLITANTE`.
  A premissa do achado, aliás, mudou junto: o CAP-1 tirou o isolamento por dono, então a sessão hoje é recurso do cinema e a assimetria "sala compartilhada + sessão isolada" que gerava a fricção não existe mais.
  Refs: `web/src/components/FormSessao.tsx:41-61,195-198`, `api/src/main/resources/db/migration/V1__schema.sql:13-18` (salas sem `organizador_id`)
