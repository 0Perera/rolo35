---
title: "Sprint Change Proposal — Painel de Turno da Portaria (FR-21 / Story 5.3)"
date: 2026-08-13
epic: Epic 5 — Validação na Portaria
scope_classification: Moderate
status: aprovado
---

# Sprint Change Proposal — Painel de Turno da Portaria

## 1. Resumo do Problema

Durante o trabalho de refinamento visual das telas da portaria (branch `epic-5-validacao-na-portaria`), o protótipo de design de referência revelou dois elementos de interface que não têm contrapartida nem no código nem nos requisitos: um contador `VALIDADOS n / total` no cabeçalho do terminal e uma lista "HISTÓRICO DA SESSÃO" com as últimas leituras.

**Categoria:** novo requisito emergente. Não é limitação técnica descoberta na implementação, nem mal-entendido de requisito original — as Stories 5.1 e 5.2 fizeram exatamente o que suas ACs pediam.

**Evidência:**

- Nenhuma das ACs da Story 5.2 trata de estado agregado do turno; todas descrevem o veredito de **uma** leitura isolada.
- FR-17 a FR-20 cobrem seleção de sessão, leitura por câmera/manual, retorno inequívoco e não-validação-duplicada. Nenhuma menciona acompanhamento de turno.
- `ValidacaoPortariaPage` descarta o resultado anterior a cada nova validação — comportamento deliberado e documentado em comentário (um "VÁLIDO" remanescente ao lado do erro seguinte lê como liberação de quem não passou). O operador não tem, hoje, nenhuma visão acumulada.

## 2. Análise de Impacto

### Impacto em épicos

| Épico | Impacto |
| --- | --- |
| Epic 5 | Recebe uma story nova (5.3). Escopo do épico cresce; nenhuma AC existente muda. |
| Epic 1–4 | Nenhum. |

O Epic 5 continua completável como planejado — 5.1 e 5.2 não precisam ser refeitas nem revertidas.

### Impacto em stories

- **5.1 e 5.2:** nenhuma alteração de AC. Permanecem `in-progress` com seus 18 action items abertos de code review.
- **5.3 (nova):** ver §4.

### Conflitos de artefato

| Artefato | Conflito | Resolução |
| --- | --- | --- |
| PRD §4.8 | Nenhuma FR cobre o comportamento. Story sem FR quebraria a convenção de rastreabilidade do projeto. | FR-21 adicionada. |
| `epics.md` | Lista de FRs, mapa FR→Epic e "FRs cobertos" do Epic 5 desatualizados. | Três pontos atualizados + Story 5.3 adicionada. |
| ARCHITECTURE-SPINE | **Nenhum conflito.** O domínio `ingressos/` já é o dono da §4.8 no Capability Map. Endpoint de leitura não toca AD-9 (`POST /portaria/validacoes` continua sendo o único a transicionar `VALIDO → UTILIZADO`). AD-12 (DTO por endpoint) e AD-2 (camada `api/` no front) se aplicam sem exceção. | Nenhuma edição necessária. |
| UX | Não existe artefato de UX versionado; o protótipo de design é a referência. Duas divergências entre protótipo e requisito, resolvidas a favor do requisito — ver §3. | Registrado nas ACs da 5.3. |
| Schema de banco | `ingressos` não tem índice em `sessao_id`; o painel filtra por essa coluna. NFR-8 exige índice em coluna de filtro. | Migration de índice na 5.3 (mesma razão do V4). |

### Impacto técnico

Nenhuma alteração no caminho de escrita. O dado que o painel precisa (`ingressos.validated_at`) já é persistido por `Ingresso.validar()` desde a Story 5.2 e nunca foi lido de volta. A story acrescenta: uma migration de índice, uma query de repository, um DTO, um método de service, uma rota `GET` e o consumo no front.

## 3. Abordagem Recomendada

**Opção escolhida: Direct Adjustment** — story nova dentro da estrutura de épico existente. Sem rollback, sem revisão de MVP.

Rollback foi descartado sem análise profunda: nada do que 5.1/5.2 entregaram está errado ou atrapalha a mudança. Revisão de MVP foi descartada porque o escopo do V1 não fica inviável — o painel é adição, não correção de rota.

### Escopo da 5.3: leitura sobre estado já persistido

Três desenhos foram avaliados:

| Opção | O que entrega | Por que não / por que sim |
| --- | --- | --- |
| Log local no front (`useState`) | Contador e histórico da sessão do navegador, incluindo tentativas recusadas. | **Rejeitada.** Terminal de portaria que perde o histórico ao recarregar a página é defeito, não feature. Não enxerga o que outro operador validou. |
| **Endpoint de leitura sobre `ingressos`** | Contador e histórico de entradas liberadas, persistidos. | **Escolhida.** Reaproveita `validated_at`, já gravado. Não toca o caminho de escrita. Custo baixo, risco nulo pra garantia principal do projeto. |
| Tabela de auditoria de validações | Histórico completo, incluindo `INVÁLIDO` / `JÁ UTILIZADO` / `EVENTO ERRADO`. | **Rejeitada por ora.** Exige escrita dentro da transação de `PortariaService.validar()` — caminho protegido por AD-5 (transação de lock curta, `lock_timeout` de 3s) e AD-9, coberto pelo teste de concorrência com Testcontainers que sustenta a SM-2. Alongar essa transação por um log é trocar risco na métrica primária por ganho cosmético. |

**Consequência aceita:** o histórico mostra apenas quem entrou. Tentativa recusada aparece na tela no momento da leitura, mas não fica registrada. Decisão deliberada, registrada nas Notas de Implementação da story — revisitar só se rastreabilidade de recusa virar requisito explícito.

### Duas correções ao protótipo de design

1. **Denominador do contador.** O protótipo mostra `VALIDADOS 37 / 120`, onde 120 é a capacidade da sala. Numa sessão com 62 ingressos vendidos, isso exibiria `37/120` e leria como sala vazia quando na verdade 60% do público já entrou. O denominador correto é ingressos **emitidos** pra sessão.
2. **Campo `CLIENTE` removido.** O card "ÚLTIMA LEITURA" do protótipo exibe o nome do cliente. Conflita diretamente com a FR-19, que veda dado do cliente além do necessário à operação. A portaria decide entrada por assento e estado, não por identidade. Fora do DTO.

Uma terceira restrição foi adicionada por conta própria: o histórico nunca exibe o código assinado completo do ingresso, apenas um prefixo curto. O código é credencial HMAC (AD-8, FR-14) — listá-lo inteiro numa tela transformaria o painel numa fonte de ingressos válidos.

### Sequenciamento

**A Story 5.3 entra em `backlog`, atrás do fechamento de 5.1/5.2 e da Story 1.3.**

Justificativa direta do PRD, SM-C1 (contra-métrica): *"não otimizar polimento visual de telas secundárias às custas de qualquer elo do fluxo vertical ficar incompleto"*. O estado atual do sprint tem elo aberto — `1-3-autocadastro-de-cliente` em `backlog`, `1-1` em `in-progress`, e 18 action items de code review abertos em 5.1/5.2. Adicionar tela nova antes de fechar isso contraria a contra-métrica que o próprio projeto declarou.

**Esforço:** baixo. **Risco:** baixo. **Impacto em prazo:** nenhum enquanto permanecer em `backlog`.

## 4. Propostas de Alteração Detalhadas

### 4.1 PRD (`planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md`)

- `updated: 2026-08-09` → `updated: 2026-08-13`.
- §4.8 ganha a **FR-21 — Painel de turno da portaria**, com sete Consequences testáveis cobrindo: dependência da sessão selecionada (FR-17), denominador por emitidos, ausência de dado do cliente (FR-19), ausência do código assinado completo (FR-14), leitura pura sem bypass (FR-20/FR-16), rejeição de `CLIENTE`/`ORGANIZADOR`, e os três estados de tela (§5, Interface).

### 4.2 Epics (`planning-artifacts/epics.md`)

- Lista de Functional Requirements: linha da FR-21 após a FR-20.
- Bloco de mapeamento FR→Epic: `FR21: Epic 5 - Painel de turno da portaria`.
- Descrição do Epic 5: `**FRs cobertos:** FR17, FR18, FR19, FR20` → `..., FR21`.
- **Story 5.3: Painel de Turno da Portaria** adicionada ao fim, com nove ACs no formato Given/When/Then e Notas de Implementação registrando o trade-off da tabela de auditoria.

### 4.3 Sprint Status (`implementation-artifacts/sprint-status.yaml`)

- `5-3-painel-de-turno-da-portaria: backlog` sob `epic-5`.
- `last_updated` atualizado com o motivo.

### 4.4 Arquitetura

Nenhuma alteração. Registrado aqui explicitamente pra que a ausência de edição seja lida como conclusão da análise, não como omissão.

## 5. Handoff

**Classificação de escopo: Moderate** — exige reorganização de backlog (story nova, sequenciamento explícito atrás de trabalho já em curso), não replanejamento fundamental.

| Papel | Responsabilidade |
| --- | --- |
| Product Owner / Dev | Manter a 5.3 em `backlog` até 5.1/5.2 saírem de `in-progress` (18 action items) e a Story 1.3 fechar. Repriorizar é decisão consciente, não default. |
| Developer | Ao puxar a 5.3: criar o arquivo de story a partir das ACs do `epics.md`, implementar sob TDD conforme NFR-10 (unitário de service + `@WebMvcTest` do endpoint; sem Testcontainers). |

**Critérios de sucesso da implementação:**

- Nenhum teste existente de portaria muda de comportamento — em especial `PortariaValidacaoConcorrenciaTest`, que não deve ser tocado.
- Resposta do painel inspecionada não contém nome, e-mail, telefone nem código assinado completo.
- Contador apresentado sobre ingressos emitidos.
- Os três estados de tela (carregando / vazio / erro) tratados.

## 5.1 Adendo — Story 2.4 e execução imediata da 5.3

Registrado depois da aprovação original, na mesma sessão.

**O que mudou.** A revisão do protótipo da tela de portaria mostrou que a seleção de sessão deveria ser uma lista navegável com busca e paginação, não o seletor suspenso entregue pela Story 5.1. Paginação server-side revisa o contrato de `GET /api/sessoes`, fechado pela Story 2.3 (`done`) e consumido por três telas — vitrine pública, terminal da portaria e detalhe do filme.

**Decisões tomadas:**

- **Story 2.4 criada no Epic 2**, dono da FR-8. Epic 2 volta a `in-progress`. FR-8 revisada no PRD com cinco consequências novas (paginação, ordenação determinística, teto de tamanho, escopo da busca, escape de curinga).
- **Story 5.1 ganha três ACs**: lista navegável em vez de seletor; turno ativo exibido uma única vez na tela; turno ativo preservado quando a listagem não o traz.
- **Offset, não keyset.** A tela oferece navegação por número de página; cursor não sabe pular pra página N. Trade-off explícito, registrado nas notas da 2.4.
- **Story 5.3 antecipada** de `backlog` para implementada, a pedido — contrariando o sequenciamento recomendado em §3. A recomendação original (fechar 5.1/5.2 e a 1.3 antes) segue de pé como risco declarado, não como bloqueio.

**Defeito encontrado e corrigido durante a execução:** com a sessão do turno também presente na página de resultados, o mesmo filme era desenhado duas vezes na tela — uma no card de turno ativo, outra na lista — sem nada indicar qual valia. A suíte de testes acusou como "Found multiple elements" antes da revisão visual. Corrigido filtrando a sessão ativa das linhas da lista; virou AC da 5.1 pra não regredir.

**Limitação conhecida, não resolvida:** a vitrine pública é uma grade **de filmes**, mas o endpoint pagina **sessões**. Um filme cujas sessões cruzam a fronteira de uma página aparece nas duas. Resolver exige um endpoint que pagine por filme, com custo próprio. Registrado aqui em vez de silenciado.

## 6. Trabalho Relacionado Fora Deste Proposal

O refinamento visual das telas da portaria (terminal escuro, moldura de leitor de QR, card de veredito) que originou a descoberta segue em separado, na mesma branch. É alteração de apresentação sobre telas existentes, sem mudança de comportamento nem de contrato de API — não constitui mudança de sprint e não depende da 5.3.
