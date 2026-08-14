# Pseudo-story CAP-12: Registrar decisões de processo já fechadas

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-12, Grupo B)

Sem RED/GREEN — documentação pura.

## Sub-item 1 — Nota do PR

- [ ] Adicionar entrada em `docs/decisions.md`: decisão de não abrir PR neste repositório (branch
  por épico, merge direto em `main`) — motivo: trabalho solo, poupar tempo/cerimônia; o gate de
  revisão real é o `bmad-code-review` em contexto novo + triagem em 3 categorias, cujo estado vive
  em `sprint-status.yaml`.
- [ ] Adicionar parágrafo equivalente no README §16 ("Como a supervisão funcionava na prática"),
  próximo do mecanismo 2 ("Quem escreve o código não aprova o código") — deixar claro que
  branch-por-épico + merge direto foi escolha deliberada, não ausência de revisão.

## Sub-item 2 — Esboço do processo criativo (README §7)

- [ ] **Não escrever a prosa final aqui** — o usuário disse que vai reescrever com as próprias
  palavras. Esta task só trava o esboço factual, pra não se perder:
  - Nome veio antes do tema: **Kineo** (grego *kinesis*, movimento/cinema) vs. **Rolo 35**
    concorrendo diretamente. Kineo puxava estética de Grécia antiga (pilares, cartaz com moldura
    clássica, menu tipo telhado de templo) — descartado por combinar mais com teatro que cinema.
  - Rolo 35 venceu: o rolo de película de 35mm era o padrão da época que o tema homenageia — o
    nome carregou o tema junto (cinema de rua/locadora 80-90, pegada arcade).
  - Referência visual: [Retromax — Retro Movie Theater Website](https://dribbble.com/shots/24299883-Retromax-Retro-Movie-Theater-Website)
    no Dribbble, buscada depois de nome e direção de tema já decididos.
  - Paleta: cartaz de **De Volta para o Futuro** — cores chamativas, bordas pontudas, contraste em
    cima de fundo simples, virou o grid quadriculado do tema.
  - Sem moodboard, sem teste de paleta alternativa — critério de gosto pessoal, sem formação de
    UX/UI.
  - Refinado em sessão com Claude Design até o protótipo de handoff (`Rolo 35.dc.html`).
- [ ] Deixar um placeholder no README §7 apontando pra esse esboço (ou deixar a seção como está até
  o usuário escrever a versão final) — **não publicar a versão gerada nesta conversa como texto
  definitivo**.

## Commit

- [ ] `docs: registra decisão de merge direto sem PR; trava esboço factual do processo criativo
  pro README §7` (sub-item 2 só entra no commit se o usuário já tiver decidido a prosa final; caso
  contrário, sub-item 1 vai sozinho e o 2 fica pendente).
