# Brechas de Regras de Negócio — Fix List

Achados de revisão adversarial (Edge Case Hunter) contra `epics.md` + stories, procurando
branch de negócio sem AC/handling — não é code review de story já implementada, é auditoria
de especificação. Só o que muda comportamento pro usuário final entra aqui; ruído de
qualidade/cosmético fica em `deferred-work.md`.

Cada item marcado `[ ]` até virar código (ou até virar `[DESCARTADO]` com o motivo).

## Como usar

- `[FIX]` — solução clara, só falta implementar.
- `[DECISÃO PENDENTE]` — precisa de uma decisão de produto antes de codar (a implementação em si é trivial).
- `[DOCUMENTAR]` — nenhuma mudança de código, só registrar a regra em `docs/decisions.md`/README.
- `[LIMITAÇÃO CONHECIDA]` — decisão de não implementar dado o escopo do desafio; só declarar no README.

---

## Épicos 3, 4, 5 (2026-08-12)

- [ ] **[FIX] Reserva não valida sessão com `dataHora` já passada** (FR-10)
  Nenhuma AC checa se a sessão selecionada ainda vai ocorrer. `ReservaService.reservar()` não compara `sessao.dataHora` com `now()` — cliente cria hold pra evento que já aconteceu.
  Fix: guard clause em `reservar()`, reaproveitando a `Sessao` já lida no fluxo de lock. Baixa complexidade.
  Refs: `_bmad-output/planning-artifacts/epics.md:27`, `api/src/main/java/br/com/rolo35/api/reservas/service/ReservaService.java`

- [ ] **[FIX] Pagamento confirma reserva de sessão já encerrada** (FR-12)
  FR-12 só rejeita "reserva de outro cliente" e "reserva já expirada" — não cobre reserva `ATIVA` (dentro do TTL de 10min) cuja sessão passou de horário nesse meio-tempo. `PagamentoService.confirmar()` emite ingresso pra evento que já aconteceu.
  Fix: mesmo guard de `dataHora`, precisa buscar `Sessao` via `reserva.sessaoId` (join extra). Complexidade baixa-média.
  Refs: `_bmad-output/planning-artifacts/epics.md:29`, `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java`

- [ ] **[DECISÃO PENDENTE] Portaria pode ativar sessão passada ou futura como "ativa pro turno"** (Story 5.1, AC2)
  Nenhuma AC restringe a lista de sessões selecionáveis a uma janela de tempo; `PortariaService.selecionarSessao()` aceita qualquer `sessaoId` existente.
  Falta decidir: o que conta como "sessão em andamento" pra portaria — só o horário exato de início? uma janela (-30min/+Xh)? Código do guard é trivial depois de decidido.
  Refs: `_bmad-output/implementation-artifacts/5-1-selecao-de-sessao-do-turno.md:16`

- [ ] **[DOCUMENTAR] Precedência não especificada entre "já utilizado" e "evento errado"** (FR-19)
  FR-19 exige "exatamente um" dos 4 resultados mas não diz qual vence quando um ingresso está simultaneamente `UTILIZADO` E de sessão diferente da selecionada. `PortariaService` já decidiu isso no código (sessão checada antes do status) sem decisão de produto registrada.
  Fix: só documentar em `docs/decisions.md` que a ordem é intencional (sessão > status). Nenhuma mudança de código.
  Refs: `_bmad-output/planning-artifacts/epics.md:36`, `_bmad-output/implementation-artifacts/5-2-validacao-de-ingresso-na-portaria.md:45-46`

- [ ] **[LIMITAÇÃO CONHECIDA] Sem estratégia de rotação do secret HMAC** (AD-8)
  Se o secret JWT/HMAC precisar trocar (vazamento/incidente), todo ingresso já emitido — inclusive link público sem expiração (FR-16) — vira `INVALIDO` de uma hora pra outra, sem caminho de migração.
  Fix real (secret versionado + validação dupla durante janela de transição) é complexidade alta, fora do escopo do desafio de 7 dias. Só declarar no README como limitação conhecida.
  Refs: `_bmad-output/planning-artifacts/epics.md:63`

## Fluxo geral, entidades, N+1 e consistência de decisões (2026-08-13)

> Varredura pedida à parte: regra irrelevante/não testável na prática, entidade com falta de informação/integridade, N+1 real no banco, inconsistência entre decisões (`ARCHITECTURE-SPINE.md`) e o que foi de fato implementado.

- [ ] **[DOCUMENTAR/REMOVER] AC de FR-19 cita "telefone" que não existe em nenhuma tabela**
  `usuarios(id, nome, email, senha_hash, papel, created_at)` — sem coluna `telefone` em lugar nenhum do schema. A AC "não inclui dado sensível do cliente além do necessário (sem e-mail, sem telefone)" é vácua nessa parte: não existe telefone pra vazar, então nenhum teste real cobre essa cláusula, ela só existe no texto. Não é bug, é rule morta — ou remove da AC ou documenta que é aspiracional pra um campo que pode vir a existir.
  Refs: `_bmad-output/planning-artifacts/epics.md:36`, `api/src/main/resources/db/migration/V1__schema.sql:1-9`

- [ ] **[FIX] `ingressos(sessao_id, assento_id)` sem FK composta contra `assento_sessao`**
  `assento_sessao` tem PK composta `(sessao_id, assento_id)` — é a fonte da verdade de que combinação sessão/assento existe de fato. `ingressos` guarda `assento_id` e `sessao_id` soltos, cada um com FK simples pra `assentos`/`sessoes`, mas nada no banco impede inserir um ingresso com uma combinação sessão/assento que nunca existiu em `assento_sessao` (ex.: assento de outra sala). Hoje inalcançável pela lógica da aplicação (`PagamentoService.confirmar()` sempre deriva os dois da mesma linha de `assento_sessao`), mas é exatamente o tipo de constraint que o non-negotiable das instruções do projeto pede ("constraints e FKs coerentes com o domínio, não só validação na aplicação"). Fix: FK composta `(sessao_id, assento_id) REFERENCES assento_sessao(sessao_id, assento_id)`.
  Refs: `api/src/main/resources/db/migration/V1__schema.sql:54-71`

- [ ] **[FIX] Sem `UNIQUE(reserva_id, assento_id)` em `ingressos`**
  Nada no banco impede duas linhas de `Ingresso` pro mesmo assento da mesma reserva — a garantia de unicidade hoje é 100% de aplicação (lista de assentos sem duplicata validada na entrada da reserva + loop único no `PagamentoService`). Mesma categoria dos outros dois "non-negotiable" de não-duplicação (assento, validação de ingresso) que o projeto resolveu com constraint de banco — este ficou de fora. Baixo risco prático (loop roda uma vez por confirmação, lock pessimista na reserva evita reentrância), mas é o único dos três invariantes de duplicação sem backstop de banco.
  Refs: `api/src/main/resources/db/migration/V1__schema.sql:63-71`, `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java`

- [x] **[N+1 — checado, não encontrado nas listagens]** `listarPublicadas()`, `findByOrganizadorId()` (`SessaoRepository`) e `buscarPorCliente()` (`IngressoRepository`) já usam `JOIN`/agregação numa query só, sem N+1 real. Único ponto próximo da categoria: `PagamentoService.confirmar()` insere os ingressos aprovados um a um (`assentoIds.stream().map(id -> ingressoRepository.save(...))`), N `INSERT`s individuais em vez de `saveAll()`/batch — inconsistente com o padrão de `reivindicarVendido()`/`liberar()` (que são `@Modifying` em lote na mesma classe). Impacto real baixo (N ≤ 6, limite de assentos por reserva), mas vale trocar por `saveAll()` se for mexer nesse método de qualquer forma.
  Refs: `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java`

- [ ] **[DOCUMENTAR] `AD-11` lista códigos de erro que nunca são usados como erro**
  A tabela de códigos do `GlobalExceptionHandler` em `AD-11` inclui `RESERVA_NAO_ATIVA` e `EVENTO_ERRADO` como exemplos de código de erro (`{codigo, mensagem}`). Nenhum dos dois é usado assim na prática: a Story 4.1 (item f dos Dev Notes) decidiu que reserva não-`ATIVA` devolve `200` com o estado persistido, sem exceção; a Story 5.2 decidiu que os 4 resultados de validação (incluindo `EVENTO_ERRADO`) voltam como `200` + campo `resultado`, nunca como erro HTTP — mesmo racional do `PagamentoDto`. `AD-11` ficou desatualizado em relação a essas duas decisões posteriores. Fix é só editar a spine (ou uma nota em `docs/decisions.md` linkando as duas ADs), sem mudança de código.
  Refs: `_bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md:108`

- [ ] **[DOCUMENTAR] Grafo de dependência de `AD-1` não declara `pagamentos → sessoes` nem `ingressos → sessoes`**
  O diagrama Mermaid de `AD-1` só desenha `pagamentos --> reservas` e `ingressos --> {reservas, pagamentos}`. Na prática, `PagamentoService` importa `sessoes.repository.AssentoSessaoRepository` direto, e `IngressoService` importa `Sala`, `Sessao`, `SalaRepository`, `SessaoRepository` de `sessoes` direto — nenhuma dessas arestas está no diagrama. Não forma ciclo nem viola a ordem declarada (`sessoes` já é upstream de todo mundo), mas o diagrama ficou incompleto em relação ao que foi de fato implementado — quem ler só a spine não prevê essas duas dependências diretas. Fix: atualizar o diagrama de `AD-1` com as duas arestas que faltam.
  Refs: `_bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md:28-38`, `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java:21`, `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java`

## UX — visibilidade de ocupação de sala entre organizadores (2026-08-13)

- [ ] **[FIX] Organizador não vê ocupação de sala de outros organizadores ao criar/editar sessão**
  `salas` é um pool compartilhado sem dono (nenhuma FK `organizador_id`), mas `sessoes` é isolada por dono (FR-2, `findByOrganizadorId`). O dropdown de sala em `FormSessao.tsx` lista todas as salas sem indicar quais horários já estão ocupados — nem pelas próprias sessões do organizador, nem (principalmente) pelas de outros organizadores, que ele nunca vê na aba de gestão. O conflito de horário (FR-6) só é descoberto depois de submeter, via `409 SESSAO_CONFLITANTE` — o organizador escolhe sala/horário às cegas.
  Não é falha de segurança (o back sempre valida com lock, FR-6 é garantido de qualquer forma) — é fricção de UX pura, nasce da combinação "sala compartilhada + sessão isolada por dono". Fix: expor ocupação da sala escolhida no form (ex.: horários já marcados nela, de qualquer organizador, sem expor de quem é cada um — só o intervalo bloqueado) antes do submit.
  Refs: `web/src/components/FormSessao.tsx`, `web/src/pages/GerenciarSessoesPage.tsx`, `api/src/main/resources/db/migration/V1__schema.sql:13-18` (salas sem `organizador_id`)
