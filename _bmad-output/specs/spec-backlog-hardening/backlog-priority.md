# Catálogo detalhado do backlog

Detalhe item a item por trás de cada capability do `SPEC.md`. Ordem = ordem de execução
sugerida dentro de cada grupo.

## Grupo A — fazer com certeza

| CAP | Item | Arquivo(s) principais | Tipo | Dependência |
|---|---|---|---|---|
| CAP-1 | Remover isolamento de dono entre organizadores | `SessaoService.java`, `SessaoNaoPertenceAoOrganizadorException.java`, testes de `sessoes` | fix + decisão registrada | nenhuma — primeiro da fila |
| CAP-2 | Reserva não valida sessão com `dataHora` passada (FR-10) | `ReservaService.java` (`reservar()`) | fix | nenhuma |
| CAP-2 | Pagamento confirma reserva de sessão encerrada (FR-12) | `PagamentoService.java` (`confirmar()`) | fix | mesmo guard do item anterior |
| CAP-3 | `ingressos` sem FK composta contra `assento_sessao` | nova migration `V*__` | fix | nenhuma |
| CAP-3 | `ingressos` sem `UNIQUE(reserva_id, assento_id)` | mesma migration acima (ou separada) | fix | pode ser bundlado com CAP-9 (`saveAll`) se `PagamentoService` for tocado de qualquer forma |
| CAP-4 | Guarda de rota protegida no front | `web/src/App.tsx`, novo componente `ProtectedRoute` | fix (UX) | nenhuma |
| CAP-5 | `docker-compose up` sobe app inteira | `docker-compose.yml`, `docs/decisions.md` | infra + decisão | nenhuma |
| CAP-6 | Deploy completo no Render | `render.yaml` (novo), `README.md` §3.7, `docs/decisions.md` | infra + decisão | nenhuma |

## Grupo B — fazer se sobrar tempo depois do Grupo A

| CAP | Item | Arquivo(s) principais | Tipo | Dependência |
|---|---|---|---|---|
| CAP-7 | Organizador não vê ocupação de sala ao criar/editar sessão | `web/src/components/FormSessao.tsx`, endpoint de apoio se necessário | fix (UX) | mais relevante ainda depois do CAP-1 |
| CAP-8 | Portaria pode ativar sessão passada/futura sem restrição — resolvido: janela `-30min/+2h` a partir de `dataHora`, constante própria (não reaproveita o buffer de 4h de conflito de sala) | `PortariaService.java` (`selecionarSessao()`) | fix | nenhuma |
| CAP-9 | `StatusAssento` não é tipo real do campo persistido | `AssentoSessao.java`, `SessaoService.java`, `ReservaService.java` | fix pequeno | nenhuma |
| CAP-9 | Duas gerações de Jackson coexistindo | `TmdbClient.java` (import `com.fasterxml.jackson.annotation.JsonProperty`) | fix pequeno | nenhuma |
| CAP-9 | `idx_sessoes_sala_id` redundante desde a V3 | nova migration `DROP INDEX` | fix pequeno | nenhuma |
| CAP-9 | Sem índice em `sessoes.organizador_id` | nova migration `CREATE INDEX` | fix pequeno | **depois do CAP-1** — a query pode mudar de forma |
| CAP-9 | `PagamentoService.confirmar()` insere ingresso um a um | `PagamentoService.java` | fix pequeno (perf) | natural de bundlar com CAP-3 (`UNIQUE`) |
| CAP-10 | Precedência "já utilizado" × "evento errado" não documentada | `docs/decisions.md` | docs só | nenhuma |
| CAP-10 | `AD-11` lista códigos de erro nunca usados como erro HTTP | `ARCHITECTURE-SPINE.md` | docs só | nenhuma |
| CAP-10 | Grafo de dependência `AD-1` incompleto | `ARCHITECTURE-SPINE.md` | docs só | nenhuma |
| CAP-10 | AC cita campo "telefone" inexistente no schema | `epics.md` | docs só | nenhuma |
| CAP-11 | Código de portaria mais curto para digitação manual — resolvido: coluna nova indexada no ingresso, código curto gerado por `SecureRandom` (Base32 Crockford, ~8 chars) na emissão; QR continua com o HMAC completo, sem mudança | `Ingresso.java`, `CodigoIngressoService.java`, nova migration, `PortariaController`/`PortariaService` (lookup por código curto) | fix | nenhuma |
| CAP-12 | Nota do PR (merge direto, trabalho solo) | `docs/decisions.md`, `README.md` §16 | docs só | nenhuma |
| CAP-12 | Esboço do processo criativo (nome, tema, paleta) | `README.md` §7 | docs só, prosa final é do usuário | nenhuma |
| CAP-13 | Aumentar seed: ~6 sessões, 2 filmes com múltiplos horários | `V2__seed.sql` (ou nova migration de seed) | dado de teste | nenhuma |

## Grupo C — candidato a cortar (declarar no README §17 se não houver tempo)

| CAP | Item | Arquivo(s) principais | Tipo | Dependência |
|---|---|---|---|---|
| CAP-15 | Documentação da API via springdoc-openapi | `pom.xml`, controllers/DTOs existentes | infra + decisão | nenhuma |

## Cortado deste ciclo (decisão já tomada, não implementar)

- **CAP-14** — Reorganização de pacotes (camada + subdomínio). Decidido não implementar agora;
  registrar como dívida técnica conhecida no README §17 em vez de decidir layout-alvo e mexer no
  código.

## Itens auditados e explicitamente fora deste backlog

Não viram capability — motivo registrado, para não serem re-levantados por engano numa futura
consolidação:

- **Rede de cinemas** (endereço por unidade, sala por organizador, portaria vinculada a
  organizador) — rejeitado; CAP-1 vai na direção oposta.
- **Divergência de título/sinopse entre sessões do mesmo filme** — levantado e retirado nesta
  conversa; não é problema real dado o design de snapshot-por-sessão.
- **Troca de sala em `editar()` sem checar hold ativo** — estava em `deferred-work.md` como
  "ação obrigatória pra Epic 3"; verificado ao vivo nesta sessão e **já está resolvido**
  (`SessaoService.java`, checagem `temHoldAtivo` presente).
- **Itens "latentes por invariante"** (edge cases de `INNER JOIN`/`LEFT JOIN` em `sessoes`,
  side-channel de tempo em `buscarPublico()`, paginação de `listarMinhas()`) — inatingíveis por
  nenhum caminho de código existente hoje; continuam registrados em `deferred-work.md` /
  `business-rules-gaps.md`, não duplicados aqui.
- **"Se sobrar tempo"**: salas com descrição de característica, assistente de IA, dashboard de
  faturamento — fora de escopo desta spec.
