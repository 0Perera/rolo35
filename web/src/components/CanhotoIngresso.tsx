import type { ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface CanhotoIngressoProps {
  /**
   * Código assinado do ingresso (`uuid.assinatura`, AD-8) — é exatamente o que o QR carrega e o
   * que `POST /api/portaria/validacoes` espera receber. Não é o link público: a portaria escaneia
   * pra validar, não pra abrir a página. Compartilhar é outro caminho, pelo botão de copiar link.
   */
  codigo: string;
  /**
   * Código curto de digitação manual. Opcional porque a página pública do ingresso não recebe
   * código nenhum do back — ela existe pra conferir o ingresso, não pra validá-lo.
   */
  codigoCurto?: string;
  children: ReactNode;
}

/**
 * Canhoto de cinema do handoff: lombada de gradiente, corpo claro com os dados e painel escuro
 * com o QR, separados por uma picotagem. Os dois lados são `flex` com base própria pra que o
 * painel do QR desça pra baixo do corpo quando o cartão não cabe numa linha, em vez de espremer
 * o QR até ele parar de ser escaneável.
 */
export function CanhotoIngresso({ codigo, codigoCurto, children }: CanhotoIngressoProps) {
  return (
    <div className="flex flex-wrap border-[3px] border-ink-950 bg-paper-50 shadow-[10px_10px_0_var(--color-ink-950)]">
      <div aria-hidden="true" className="w-[14px] bg-gradient-to-b from-flame-600 via-flame-500 to-flame-400" />
      <div className="min-w-0 flex-[1_1_320px] p-[clamp(20px,3cqw,34px)]">{children}</div>
      <div
        aria-hidden="true"
        className="w-[3px] bg-[repeating-linear-gradient(180deg,var(--color-ink-950)_0_10px,transparent_10px_18px)]"
      />
      {/* A base do painel acompanha o QR: 196px de código + moldura + padding. Com uma base menor
          que isso, o QR estoura o painel nas larguras intermediárias em vez de descer pra linha
          de baixo. */}
      <div className="flex flex-[1_1_270px] flex-col items-center justify-center gap-3 bg-ink-950 p-6">
        <div className="border-[3px] border-flame-400 bg-paper-50 p-2.5">
          {/* marginSize em módulos, não pixels: a zona de silêncio precisa existir dentro do
              próprio SVG pra leitura confiável — a borda amarela do handoff é decoração, não
              margem de QR. */}
          <QRCodeSVG
            value={codigo}
            size={196}
            marginSize={4}
            bgColor="#FFFDF6"
            fgColor="#171219"
            title="QR code do ingresso, para leitura na portaria"
          />
        </div>
        <p className="text-center font-mono text-[17px] tracking-[2px] text-cyan-400">ESCANEIE NA PORTARIA</p>
        {/* O plano B da câmera, e por isso vem em corpo grande: quem está na fila precisa ler ele
            em voz alta pro operador digitar. Sem I, L, O e U, por construção. */}
        {codigoCurto && (
          <p className="text-center font-mono text-[15px] tracking-[2px] text-[#9C9488]">
            OU DITE O CÓDIGO
            <span className="mt-1 block text-[26px] tracking-[6px] text-paper-50">{codigoCurto}</span>
          </p>
        )}
      </div>
    </div>
  );
}
