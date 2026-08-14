---
id: SPEC-backlog-hardening
companions: ["backlog-priority.md"]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete,
> preservation-validated contract for what to build, test, and validate. Source documents listed
> in frontmatter are for traceability only — consult them only if you need narrative rationale or
> prose color this contract intentionally omits.

# Backlog de correções, hardening e decisões pendentes

## Why

Mandato de prazo: é o penúltimo dia do desafio de 7 dias corridos do rolo35, e a auditoria feita
nesta sessão — código lido ao vivo, cruzado contra o requisito oficial e contra o histórico de
code review já registrado no projeto — levantou 23 itens concretos que valem correção: um escopo
que ninguém pediu (isolamento multi-tenant entre organizadores) contradizendo o requisito oficial,
gaps de validação de horário em reserva/pagamento, invariantes de banco sem backstop, uma guarda
de rota no front pedida três vezes em code reviews anteriores e nunca implementada, itens de
infraestrutura de deploy, e um conjunto de correções só de documentação. Nada garante que este
será o único ciclo de acabamento — por isso o backlog é priorizado em grupos, não tratado como
lista fechada de "última chance".

## Capabilities

- **CAP-1** — Grupo A, tratamento especial: commit isolado
  - **intent:** Remover o isolamento de dono entre organizadores; sessão vira recurso do cinema
    (equipe compartilhada), não do organizador que a criou.
  - **success:** Qualquer `ORGANIZADOR` autenticado edita/gerencia qualquer sessão;
    `SessaoNaoPertenceAoOrganizadorException` removida; testes atualizados; commit próprio, com
    entrada dedicada em `docs/decisions.md` escrita no mesmo commit, não no lote do resto do
    backlog.

- **CAP-2** — Grupo A
  - **intent:** Reserva e pagamento passam a rejeitar sessão cujo horário já passou (FR-10, FR-12).
  - **success:** `ReservaService.reservar()` e `PagamentoService.confirmar()` rejeitam `dataHora`
    no passado, cada um com teste RED→GREEN provando o guard.

- **CAP-3** — Grupo A
  - **intent:** `ingressos` ganha os backstops de banco que faltam para seus invariantes de
    não-duplicação (FK composta contra `assento_sessao`, `UNIQUE(reserva_id, assento_id)`).
  - **success:** Migration nova aplicada com as duas constraints; testes existentes continuam
    verdes.

- **CAP-4** — Grupo A
  - **intent:** Front-end ganha guarda de rota protegida por papel, item pedido em 3 code reviews
    anteriores e nunca implementado.
  - **success:** `/organizador/*`, `/portaria/*` e `/pagamento/:reservaId` deixam de renderizar
    para visitante sem papel certo, antes de qualquer resposta do back.

- **CAP-5** — Grupo A
  - **intent:** `docker-compose up` sobe a aplicação inteira — front, API e banco — com um comando
    só.
  - **success:** Front vira serviço no `docker-compose.yml`; decisão registrada em
    `docs/decisions.md`.

- **CAP-6** — Grupo A
  - **intent:** Deploy completo no Render (Static Site para o front, Web Service para a API,
    Postgres gerenciado), via um blueprint único, substituindo API-no-Render + front-na-Vercel.
  - **success:** `render.yaml` funcional subindo os 3 serviços; limitação de sleep documentada no
    README §3.7 atualizada para refletir o novo cenário (Static Site não dorme).

- **CAP-7** — Grupo B
  - **intent:** Formulário de sessão mostra ocupação da sala escolhida antes do submit.
  - **success:** Form exibe intervalos já ocupados da sala, sem expor de quem é cada sessão;
    reduz descoberta de conflito só via `409` pós-submit.

- **CAP-8** — Grupo B
  - **intent:** Restringir quais sessões a portaria pode ativar como "sessão do turno" a uma
    janela de tempo definida: `-30min/+2h` a partir de `dataHora`, constante própria e separada
    do buffer de 4h já usado pro conflito de sala.
  - **success:** Guard aplicado em `PortariaService.selecionarSessao()` rejeitando sessão fora da
    janela, com teste; decisão registrada em `docs/decisions.md`.

- **CAP-9** — Grupo B, sequenciado depois do CAP-1
  - **intent:** Fechar inconsistências pequenas já sinalizadas: `StatusAssento` como tipo real
    persistido, unificação das duas gerações de Jackson, índice redundante `idx_sessoes_sala_id`
    removido, índice em `sessoes.organizador_id` adicionado, `saveAll()` em
    `PagamentoService.confirmar()`.
  - **success:** Cada item específico fechado com sua própria verificação; o índice de
    `organizador_id` só é decidido depois de saber a forma final da query pós-CAP-1.

- **CAP-10** — Grupo B, sem mudança de código
  - **intent:** Registrar em documentação decisões que o código já toma implicitamente ou lacunas
    de especificação já identificadas (precedência de resultado de validação, `AD-11`
    desatualizado, grafo `AD-1` incompleto, critério de aceite citando campo inexistente).
  - **success:** 4 entradas registradas em `docs/decisions.md` e/ou na arquitetura.

- **CAP-11** — Grupo B
  - **intent:** Código curto para digitação manual na portaria, mapeado no banco — coluna nova
    indexada no ingresso, gerada por `SecureRandom` (ex.: Base32 tipo Crockford, ~8 caracteres) na
    emissão. O QR continua carregando o código HMAC completo, sem mudança; o código curto existe
    só pro caminho de digitação manual, sem rebaixar a segurança do caminho principal (câmera).
  - **success:** Coluna e geração implementadas; validação por código curto faz o lookup e segue o
    mesmo fluxo de verificação já existente; QR e link público inalterados.

- **CAP-12** — Grupo B
  - **intent:** Registrar decisões de processo já fechadas nesta conversa: ausência de PR
    (merge direto, trabalho solo) e o esboço factual do processo criativo do nome/tema/paleta.
  - **success:** Entradas em `docs/decisions.md`/README §16; README §7 sinalizado como pendente
    de prosa final autoral do usuário.

- **CAP-13** — Grupo B
  - **intent:** Seed de sessões cresce para ~6 sessões distintas, 2 filmes com mais de um
    horário/data.
  - **success:** Seed atualizado; migrations e testes existentes continuam passando.

- **CAP-14** — Cortado deste ciclo
  - **intent:** Reorganizar pacotes do back-end por camada (entidade/exceção em subpasta própria)
    e por subdomínio (separar `portaria` de `ingressos`, decidir onde `catalogo` vive).
  - **success:** Não implementado neste ciclo — decisão explícita de não mexer agora; registrado
    como dívida técnica conhecida no README §17.

- **CAP-15** — Grupo C, candidato a cortar
  - **intent:** Documentação da API via `springdoc-openapi` (Swagger UI).
  - **success:** `/swagger-ui.html` funcional; decisão sobre anotar o envelope `{codigo,
    mensagem}` registrada; se não houver tempo, vira dívida declarada.

## Constraints

- Penúltimo dia do prazo de 7 dias: os grupos A/B/C acima **são** a priorização — C é descartável
  e vai para o README §17 como limitação honesta se não sobrar tempo, nunca fica escondido.
- Todo item de código nasce com teste primeiro (RED→GREEN→REFACTOR→COMMIT), seguindo o processo
  já em uso no projeto.
- Sem PR: merge direto na branch de trabalho atual, conventional commits, um commit por
  capability/item — não um commit-lote no fim.
- CAP-1 é commit isolado com entrada própria em `docs/decisions.md` escrita no mesmo commit.
- A branch `epic-5-validacao-na-portaria` está em uso por outra sessão em paralelo; este backlog
  só começa depois dela mergear em `main`.
- CAP-9 é sequenciado depois do CAP-1, porque a query que o índice de `organizador_id` apoiaria
  pode mudar de forma com a remoção do isolamento.

## Non-goals

- Modelar rolo35 como rede de cinemas (endereço por unidade, sala por organizador, portaria
  vinculada a organizador) — rejeitado; confirmado contra o PDF oficial do desafio, que só
  especifica um organizador seedado, sem isolamento multi-tenant. CAP-1 vai na direção oposta.
- Corrigir divergência de título/sinopse entre sessões do mesmo filme — levantado e retirado:
  baixa probabilidade, baixo impacto, decisão de snapshot-por-sessão já é a correta.
- Job agendado de delete/arquivamento de sessões antigas — contradiz a decisão de TTL preguiçoso
  sem scheduler já registrada; retenção indefinida é só documentada, não corrigida com código.
- Preenchimento de laterais vazias no layout (decorativo ou por escala proporcional de
  elementos) — fora de escopo desta spec.
- Itens de "se sobrar tempo" (salas com descrição de característica, assistente de IA, dashboard
  de faturamento) — mencionados, fora do escopo desta spec, não viram capability.

## Success signal

Todos os itens do Grupo A implementados com commit próprio e teste antes do fim do prazo; itens
do Grupo B implementados na medida do tempo restante; qualquer item de B ou C que não couber é
declarado honestamente no README §17 em vez de omitido — mesmo padrão que o README já usa hoje
para outras lacunas conhecidas.

