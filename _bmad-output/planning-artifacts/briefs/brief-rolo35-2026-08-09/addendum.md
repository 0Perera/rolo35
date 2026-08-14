---
title: "Addendum: rolo35 — Plataforma de Eventos e Ingressos"
status: draft
created: 2026-08-09
updated: 2026-08-09
---

Conteúdo capturado durante o brief que pertence a documentos posteriores (PRD, arquitetura, stories) — não ao brief em si.

## Constraints de processo para PRD / épicos / stories

Levantadas pelo usuário em 2026-08-09; não são decisões de produto, são regras de execução que o PM e o processo de criação de stories devem herdar:

- **Primeira story = fatia vertical fina do fluxo completo.** Login → busca de filme → reserva → pagamento simulado → ingresso com QR → validação na portaria, cada etapa simplificada ao mínimo. Só depois fatiar por funcionalidade/tela. (Já alinhado com "Fatia vertical primeiro" nas instruções do projeto — o PM deve traduzir isso na primeira entrada do backlog, não deixar implícito.)
- **Non-negotiables de segurança das instruções do projeto como critério de aceite explícito**, não implícito. Toda story que toca um desses pontos precisa declarar no seu AC, por exemplo: assinatura do QR não forjável (HMAC/JWT assinado), constraint de banco contra dupla-venda de assento, constraint contra validação dupla de ingresso.
- **Estratégia de teste por story já fechada** (replicar a tabela das instruções do projeto nos critérios de aceite de cada story):
  - Regra de negócio pura → unitário (JUnit + Mockito, sem contexto Spring)
  - Endpoint / autorização → `@WebMvcTest` com service mockado
  - Precisa do banco de verdade → Testcontainers, reservado para os dois cenários de concorrência (assento, validação de ingresso) e smoke tests de repository
  - Interação visual (mapa de assentos, câmera) → cobertura leve escrita depois do componente, focada em contrato de comportamento
