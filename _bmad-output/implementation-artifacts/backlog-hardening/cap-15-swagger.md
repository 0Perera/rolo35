# Pseudo-story CAP-15: Documentação da API via springdoc-openapi

Status: ready-for-dev — **Grupo C, candidato a cortar**
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-15, Grupo C)

> Se o tempo não fechar, não implementar — declarar como dívida conhecida no README §17 em vez de
> fazer pela metade.

## Story

As desenvolvedor/avaliador explorando a API,
I want uma UI de documentação gerada automaticamente,
so that eu não preciso ler controller por controller pra saber os endpoints disponíveis.

## Acceptance Criteria

1. **Given** a dependência `springdoc-openapi-starter-webmvc-ui` adicionada **When** a API sobe
   **Then** `/swagger-ui.html` responde com a UI carregada, listando todos os controllers.
2. **Given** os DTOs em `record` já existentes **When** a documentação é gerada **Then** os campos
   aparecem corretamente tipados, sem anotação manual extra necessária pra maioria dos casos.
3. **Given** a decisão sobre o envelope de erro **When** tomada **Then** documentada em
   `docs/decisions.md` — anotar ou não `ApiError`/`{codigo, mensagem}` explicitamente nos
   controllers (trade-off: mais completo vs. mais anotação espalhada pelo código).

## Tasks / Subtasks

- [ ] **Task 1 — Dependência e smoke test**
  - [ ] Adicionar `springdoc-openapi-starter-webmvc-ui` no `pom.xml`.
  - [ ] Teste simples (`@SpringBootTest` ou `@WebMvcTest` mínimo) confirmando que
    `/v3/api-docs` retorna `200` com um JSON não-vazio.
  - [ ] Subir a aplicação localmente e conferir visualmente `/swagger-ui.html`.
  - [ ] Commit: `feat(api): adiciona documentação Swagger via springdoc-openapi`

- [ ] **Task 2 — Decisão sobre o envelope de erro**
  - [ ] Decidir: anotar `@ApiResponse` com o schema de `ApiError` nos endpoints principais, ou
    deixar só a documentação automática dos DTOs de sucesso.
  - [ ] Registrar a decisão em `docs/decisions.md`.
  - [ ] Se decidido anotar: adicionar `@ApiResponse`/`@Schema` nos controllers principais
    (`SessaoController`, `ReservaController`, `PagamentoController`, `PortariaController`).

## Dev Notes

- Baixo risco técnico (biblioteca madura, geração majoritariamente automática) — o custo real é
  tempo de revisão visual, não implementação.
- Se cortado, adicionar ao README §17 ("Dívida técnica que eu reconheço como dívida"): "Sem
  documentação Swagger/OpenAPI — endpoints documentados só na seção 6 do README (Referência da
  API), escrita manualmente."
