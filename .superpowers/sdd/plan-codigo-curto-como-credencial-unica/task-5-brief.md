### Task 5: Contrato do front e resolução do link

**Files:**
- Modify: `web/src/api/ingressos.ts:4-23`
- Modify: `web/src/api/pagamentos.ts:5-11`
- Create: `web/src/lib/useLinkDoIngresso.ts`
- Modify: `web/src/lib/ingressos.ts:1-8`

**Interfaces:**
- Consumes: `GET /api/ingressos/{id}/link` da Task 4.
- Produces: `buscarLinkDoIngresso(id: string): Promise<{ codigo: string }>`; `useLinkDoIngresso(ingressoId: string): string | null`; `IngressoResumo` sem `codigo`; `IngressoPublico` com `codigoCurto`; `IngressoEmitido` sem `codigo`.

- [ ] **Step 1: Ajustar os tipos**

Em `web/src/api/ingressos.ts`, remover `codigo` de `IngressoResumo`, acrescentar `codigoCurto` a `IngressoPublico`, e adicionar:

```ts
export interface LinkIngresso {
  /** Token assinado `uuid.assinatura`. A URL é montada por `urlPublicaDoIngresso`. */
  codigo: string;
}

/** Cunha o token do link público. Só o dono do ingresso recebe 200. */
export function buscarLinkDoIngresso(id: string): Promise<LinkIngresso> {
  return apiFetch<LinkIngresso>(`/api/ingressos/${id}/link`);
}
```

Em `web/src/api/pagamentos.ts`, remover `codigo` de `IngressoEmitido` e atualizar o comentário de `codigoCurto`, que hoje diz "pra ditar na portaria quando a câmera não lê" — virou a credencial única, não o plano B:

```ts
export interface IngressoEmitido {
  id: string;
  assentoId: number;
  /** Credencial do ingresso: vai no QR, vale na portaria, e dá pra ditar na fila. */
  codigoCurto: string;
}
```

- [ ] **Step 2: Escrever o hook**

`web/src/lib/useLinkDoIngresso.ts`:

```ts
import { useEffect, useState } from 'react';
import { buscarLinkDoIngresso } from '../api/ingressos';
import { urlPublicaDoIngresso } from './ingressos';

/**
 * Resolve o link público de um ingresso quando o canhoto monta, não quando o botão é clicado.
 *
 * A diferença não é estética: o WebKit exige que a escrita no clipboard aconteça na mesma tarefa do
 * gesto do usuário. Um handler `async` que busca o link e só então copia perde a permissão implícita
 * no `await`, e a cópia falha calada — o botão pisca "copiado" no iPhone sem ter copiado nada.
 */
export function useLinkDoIngresso(ingressoId: string): string | null {
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarLinkDoIngresso(ingressoId)
      .then((resposta) => {
        if (ativo) {
          setLink(urlPublicaDoIngresso(resposta.codigo));
        }
      })
      .catch(() => {
        // Silêncio proposital: sem link o botão de compartilhar fica desabilitado, e o resto do
        // canhoto — QR e código curto, que é o que faz o cliente entrar na sala — segue de pé.
      });
    return () => {
      ativo = false;
    };
  }, [ingressoId]);

  return link;
}
```

- [ ] **Step 3: Corrigir o comentário de `lib/ingressos.ts`**

O comentário atual (`:1-5`) diz que a URL é "o que o botão de compartilhar copia e **o que o QR carrega**". A segunda metade ficou falsa:

```ts
/**
 * Link público do ingresso — é o que o botão de compartilhar copia, e nada além disso. O QR **não**
 * carrega URL: ele carrega o código curto, que é a credencial que a portaria valida. Mora no `lib`
 * porque a carteira e a página pública precisam gerar exatamente a mesma URL.
 */
```

- [ ] **Step 4: Verificar a compilação**

Run: `npm run build --prefix web`
Expected: FAIL, com erros apontando cada uso de `ingresso.codigo` nos componentes — essa lista é o roteiro das Tasks 6 e 7.

- [ ] **Step 5: Commit**

```bash
git add web/src/api web/src/lib
git commit -m "feat(web): contrato do link público sob demanda"
```

---

