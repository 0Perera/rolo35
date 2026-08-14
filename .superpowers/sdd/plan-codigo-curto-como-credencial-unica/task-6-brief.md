### Task 6: QR carrega o código curto

**Files:**
- Modify: `web/src/components/CanhotoIngresso.tsx:4-17,42-59`
- Modify: `web/src/components/AcoesDoIngresso.tsx`

**Interfaces:**
- Consumes: `useLinkDoIngresso` da Task 5 (usado pelos chamadores, não por estes componentes).
- Produces: `CanhotoIngresso({ codigoCurto: string, children: ReactNode })`; `AcoesDoIngresso({ codigoCurto: string, linkPublico: string | null, className?: string })`.

- [ ] **Step 1: Reescrever `CanhotoIngresso`**

A prop `codigo` some e `codigoCurto` deixa de ser opcional — a página pública agora também o recebe:

```tsx
interface CanhotoIngressoProps {
  /**
   * Credencial do ingresso: 8 caracteres Base32 Crockford. É o que o QR carrega e o que
   * `POST /api/portaria/validacoes` espera. Não é o link público — a portaria escaneia pra validar,
   * não pra abrir página; compartilhar é outro caminho, pelo botão de link.
   */
  codigoCurto: string;
  children: ReactNode;
}
```

No corpo, `<QRCodeSVG value={codigoCurto} ... />`, e o bloco `{codigoCurto && (...)}` (`:54-59`) perde a guarda, virando renderização incondicional. Ajustar também o comentário acima dele (`:52-53`), que chama o código curto de "plano B da câmera": agora câmera e digitação leem o mesmo valor, e o corpo grande existe porque quem está na fila dita ele em voz alta.

Manter `marginSize={4}`: a zona de silêncio continua obrigatória dentro do próprio SVG, e a borda amarela do handoff segue sendo decoração (nota da Story 4.2, `docs/decisions.md`).

Sobre `size={196}`: o payload cai de ~80 caracteres para 8, então o QR desce de uma versão alta para uma bem baixa — muito menos módulos, cada um muito maior no mesmo lado de 196px. **Manter os 196px.** O `size` casa com a base de 270px do painel escuro (`:37`, comentada como "196px de código + moldura + padding"); mudar o número quebraria esse cálculo e faria o QR estourar o painel nas larguras intermediárias. Módulo maior no mesmo espaço é ganho de leitura em tela riscada ou com brilho baixo — exatamente o cenário que motivou o código curto existir.

- [ ] **Step 2: Reescrever `AcoesDoIngresso`**

```tsx
interface AcoesDoIngressoProps {
  codigoCurto: string;
  /** `null` enquanto o link não foi resolvido, ou se a busca falhou. */
  linkPublico: string | null;
  className?: string;
}
```

O javadoc do componente (`:22-33`) precisa de reescrita: a justificativa atual do botão de copiar — "selecionar `uuid.assinatura` com o dedo é inviável: uma palavra só, longa" — morreu junto com o código longo. O botão sobrevive por outro motivo:

```tsx
/**
 * O rodapé de ações do canhoto: compartilhar o link público e copiar o código do ingresso.
 *
 * <p>São coisas diferentes e trocar uma pela outra quebra o fluxo — link colado no campo da portaria
 * não valida, e código colado no WhatsApp não abre página nenhuma. Daí os dois botões, com o
 * compartilhar em destaque (é a ação frequente).
 *
 * <p>Copiar o código continua valendo mesmo com 8 caracteres: quem manda o código por mensagem
 * digitando à mão troca um caractere e o outro lado chega na portaria com um ingresso que não existe.
 * Os 8 caracteres já evitam I, L, O e U por isso mesmo; copiar fecha o resto do buraco.
 *
 * <p>O link chega pronto por prop, nunca buscado no clique: ver `useLinkDoIngresso`.
 */
```

No corpo, o botão de compartilhar ganha guarda e o de copiar passa a entregar o código curto:

```tsx
      <button
        type="button"
        disabled={linkPublico === null}
        onClick={() => linkPublico && link.copiar(linkPublico)}
        className={buttonClass('ticket', 'disabled:cursor-not-allowed disabled:opacity-50')}
      >
        {ROTULOS_LINK[link.estado]}
      </button>

      <button
        type="button"
        onClick={() => codigoCopia.copiar(codigoCurto)}
        className={buttonClass('ticket', 'bg-none bg-paper-50 text-ink-950 hover:bg-paper-100 hover:text-ink-950')}
      >
        {ROTULOS_CODIGO[codigoCopia.estado]}
      </button>
```

O `<span aria-live="polite">` (`:56-62`) fica exatamente como está.

- [ ] **Step 3: Commit parcial**

Estes dois componentes não compilam sozinhos — os chamadores só são ajustados na Task 7. Commitar mesmo assim mantém o histórico legível; a árvore fica verde no fim da Task 7.

```bash
git add web/src/components/CanhotoIngresso.tsx web/src/components/AcoesDoIngresso.tsx
git commit -m "feat(web): QR do canhoto carrega o código curto"
```

---

