---
title: "Product Brief: rolo35 — Plataforma de Eventos e Ingressos"
status: final
created: 2026-08-09
updated: 2026-08-09
---

# Product Brief: rolo35 — Plataforma de Eventos e Ingressos

## Resumo Executivo

rolo35 é uma plataforma de eventos e ingressos com foco em cinema: um organizador monta sessões a partir de um catálogo de filmes (TMDb), definindo data, sala, capacidade e preço; um cliente busca sessões, reserva um assento num mapa de cinema, paga de forma simulada e recebe um ingresso com QR assinado, que pode compartilhar por link público; na entrada, a portaria valida o ingresso com leitura de câmera ou digitação manual.

O projeto nasce com um prazo curto de 7 dias corridos, o que torna a decisão com intenção mais valiosa que volume de funcionalidades — os requisitos de partida são deliberadamente enxutos, porque colar um requisito genérico numa ferramenta de IA já devolve um sistema pronto e genérico. O valor está em decidir com intenção onde os requisitos deixam espaço em aberto (qual API, qual modelo de reserva, quais regras de negócio implícitas) e em documentar esse raciocínio, não em esconder o uso de IA.

Este brief registra essas decisões e as regras de negócio necessárias para alimentar a criação do PRD e da arquitetura na sequência — é o documento de alinhamento interno que evita que a IA (ou o próprio autor, sob pressão de prazo) preencha as lacunas de forma arbitrária mais adiante.

## Contexto e Solução

**O problema que o domínio modela**: comprar ingresso de cinema tem dois riscos operacionais clássicos que qualquer solução séria precisa fechar — vender o mesmo assento duas vezes sob concorrência (dois clientes reservando ao mesmo tempo) e aceitar o mesmo ingresso duas vezes na portaria (QR fotografado e reusado, ou digitado de memória). Uma implementação ingênua resolve isso só na camada de aplicação; este projeto trata os dois como invariantes de banco (constraint/lock), não como validação que pode ser burlada em condição de corrida.

**A solução**: três fluxos ligados por um domínio de reserva único.

- *Organizador* escolhe um filme no catálogo TMDb (proxy exclusivo do back-end — a chave TMDb nunca chega ao client) e monta uma sessão: sala, capacidade, preço, data.
- *Cliente* navega sessões publicadas, escolhe assento num mapa de cinema (não pista/quantidade — decisão já tomada), reserva, paga num endpoint simulado que cobre aprovação e recusa, e recebe um ingresso com QR assinado (HMAC/JWT — não um ID incrementável). Pode compartilhar o ingresso por link público, somente leitura, sem exigir login de quem recebe.
- *Portaria* lê o QR pela câmera (ou digita o código manualmente) e recebe um retorno claro: válido, inválido, já utilizado, ou evento errado.

Autenticação JWT com três papéis (`ORGANIZADOR`, `CLIENTE`, `PORTARIA`), autorização checada em toda requisição no back-end — nunca só escondendo botão no front.

## Quem Isso Atende

- **Organizador** — monta e publica sessões; precisa confiar que a capacidade e o preço que definiu são respeitados sem venda duplicada, e que consegue corrigir informação de sessão sem quebrar ingressos já vendidos.
- **Cliente** — busca um filme, quer saber rápido se tem assento disponível numa sessão que atenda sua data/local, e quer um ingresso que funcione na portaria sem fricção (inclusive se compartilhado com quem vai acompanhá-lo).
- **Portaria** — no fluxo de entrada, precisa de uma resposta inequívoca por ingresso, rápida o suficiente para uma fila real, sem depender de olhar o banco de dados manualmente.

## Regras de Negócio Decididas

Os requisitos originais não definem estas regras — ficariam implícitas ou decididas ad-hoc durante a implementação se não fossem fechadas aqui. Cada uma parte de precedente de mercado (ingresso.com, eventim, sympla — referências do próprio projeto), da prioridade de simplicidade do projeto, ou da mesma classe de proteção de concorrência já exigida pelos non-negotiables do `CLAUDE.md`.

| Regra | Decisão | Justificativa |
|---|---|---|
| TTL de reserva sem pagamento confirmado | 10 minutos | Cobre abandono de tela de pagamento sem segurar assento indefinidamente. Mecanismo de expiração (lazy check vs. job agendado) é decisão de arquitetura, não deste brief. |
| Assento após recusa de pagamento | Libera imediatamente | Recusa é fim de linha para aquela tentativa, não um estado intermediário. |
| Cancelamento de ingresso confirmado | Fora do v1 | Feature explicitamente opcional nos requisitos; implica reembolso simulado, restock de assento e invalidação de QR já emitido — complexidade que compete com o fluxo ponta a ponta. |
| Expiração do link de compartilhamento | Não expira | O link espelha o estado do ingresso (válido/usado/evento errado); não tem ciclo de vida próprio. |
| Limite de assentos por reserva | 6 assentos | Evita o caso degenerado de uma reserva esgotar a sala inteira; convenção comum do setor. |
| Edição de evento com ingresso já vendido | Bloqueia edição de **todos os campos** — data, sala/capacidade, preço, título e sinopse — se houver ≥1 ingresso confirmado, sem exceção | Editar dado que afeta o que o cliente já pagou quebra integridade. Título/sinopse vêm do TMDb, não de digitação livre do organizador — não existe "corrigir erro de digitação" que justifique deixá-los abertos; permitir a troca depois da venda abriria brecha pra vender ingresso de um filme e substituir por outro depois que o cliente já pagou. (Revisado em 2026-08-09; versão anterior deixava título/sinopse editáveis.) |
| Granularidade do ingresso numa reserva multi-assento | Um ingresso por assento, cada um com QR próprio | Na portaria real cada pessoa entra com seu próprio ingresso; um ingresso único pra reserva de até 6 assentos forçaria validação parcial que ninguém pediu. |
| Cadastro obrigatório | Só exigido no momento da reserva de assento (início da compra); busca de sessões e visualização do mapa de assentos são livres, sem login. (Adicionada em 2026-08-09.) | Reduz fricção de descoberta — cliente vê disponibilidade real antes de decidir se cadastra; nada sensível é exposto na exploração; é o padrão de mercado (ingresso.com, eventim permitem navegação sem conta). |
| Modelo de sala | Sala é um recurso com mapa de assentos fixo (linhas × colunas), reutilizável entre sessões; a capacidade da sessão é o tamanho do mapa da sala escolhida | Capacidade como número livre pode dessincronizar do mapa real — e sem assento fixo, "não vender o mesmo assento duas vezes" perde referência. |
| Conflito de horário na mesma sala | Bloqueado — duas sessões não podem ocupar a mesma sala no mesmo horário | Sala é recurso físico único; sem a regra, o organizador publica sessões simultâneas na mesma sala sem o sistema recusar. |
| Data da sessão no passado | Bloqueado — sessão precisa ter data/hora futura no momento da criação | Fecha um buraco de validação óbvio que, sem regra explícita, ninguém pensa em tratar. |
| Contexto de validação da portaria | Portaria seleciona a sessão do turno antes de escanear; "evento errado" é o ingresso não bater com essa sessão selecionada | Dá ao retorno "evento errado", pedido nos requisitos, algo concreto pra comparar. |
| Escopo de gestão do organizador | Organizador só edita/gerencia eventos que ele mesmo criou | Checagem de papel sozinha não implica isso; sem a regra, qualquer organizador autenticado mexe no evento de outro. |
| Papel por conta | Um papel fixo por conta (`ORGANIZADOR`, `CLIENTE` ou `PORTARIA`), sem acumular | Mantém a modelagem simples e é consistente com o seed de dados (contas distintas por papel). |
| Sessão esgotada na busca | Continua visível, marcada como esgotada — não some da listagem | Sumir sem explicação é pior experiência que mostrar "esgotado"; é o padrão de ingresso.com/eventim. |
| Concorrência no pagamento | Confirmação de pagamento de uma reserva é idempotente — duas requisições simultâneas não geram dois ingressos | Mesma classe de condição de corrida que motiva o non-negotiable de dupla-venda de assento; sem a regra, a mesma categoria de bug entra pela porta dos fundos do pagamento. |

## Escopo

**V1 — fluxo vertical completo, ponta a ponta**: login/papéis → busca de filme (TMDb) → escolha de sessão → reserva de assento em mapa de cinema → pagamento simulado (aprovação e recusa) → ingresso com QR assinado → "Meus ingressos" → validação na portaria (câmera + digitação manual) → link de compartilhamento público. As seis regras de negócio acima valem desde a primeira fatia vertical, não como polimento posterior.

**Já decidido como fora de escopo** (do `CLAUDE.md`, não deste brief): nota fiscal, revenda de ingresso entre usuários, aplicativo nativo, recuperação de senha, envio de ingresso por e-mail. Cancelamento de ingresso (ver tabela acima).

**Candidatos a stretch — prioridade fica para o PRD decidir**: busca e filtro avançado de eventos, painel do organizador além do CRUD básico de sessão, mapa de assentos em tempo real (WebSocket). Testes automatizados e deploy (Render + Vercel) já são compromissos assumidos no `CLAUDE.md`, não itens opcionais deste brief.

## Critérios de Sucesso

- O fluxo vertical completo roda de ponta a ponta antes de qualquer refinamento de tela — se algo tiver que ficar pela metade sob pressão de prazo, é um extra, nunca um elo da cadeia principal.
- Nenhum dos dois cenários de concorrência (dupla-venda de assento, dupla-validação de ingresso) falha sob teste de concorrência real (Testcontainers) — não é suficiente "parecer certo" em teste manual sequencial.
- README permite a alguém sem contexto prévio rodar o projeto do zero (Docker Compose + seed) e percorrer os quatro perfis de teste sem montar dado manualmente.
- Uso de IA documentado com honestidade, incluindo o que foi ajustado ou rejeitado — não só o que foi aceito como veio.

## O Que Evita Ser Genérico

O risco real deste projeto não é técnico, é estético e decisório: qualquer um cola os requisitos numa ferramenta de IA e recebe uma aplicação funcional com cara de SaaS genérico. Duas coisas defendem contra isso:

1. **Decisão explícita onde os requisitos são ambíguos** — as seis regras de negócio acima, a escolha de mapa de assentos sobre pista, TMDb sobre Ticketmaster, cada uma registrada com o porquê em `docs/decisions.md`, não deduzível só lendo o código.
2. **Identidade visual não-genérica** — tema cinema clássico anos 80/90 (rolo de película 35mm), contagem regressiva de abertura como transição, perfuração de película como moldura, paleta sépia/âmbar + vermelho veludo + dourado, tipografia robusta estilo marquise. Já fixado no `CLAUDE.md`; este brief só reforça que é non-negotiable, não polimento de fim de sprint.
