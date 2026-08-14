import { useState, type ReactNode } from 'react';

/**
 * Pôster do tubo, que só aparece depois de carregado.
 *
 * <p>Trocar o `src` seco deixava o tubo no preto do fundo enquanto o arquivo novo baixava — a cada
 * troca de canal e a cada troca de filtro. O estado é local e a chave de fora é a URL: pôster novo
 * monta um componente novo, e o `carregado` do anterior não vaza pra ele.
 */
function PosterDoTubo({ url }: { url: string }) {
  const [carregado, setCarregado] = useState(false);
  return (
    <img
      data-testid="hero-poster"
      src={url}
      alt=""
      aria-hidden
      onLoad={() => setCarregado(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
        carregado ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

interface TvDeTuboProps {
  posterUrl: string | null;
  /** Sem canal a exibir: o tubo continua ligado, mostrando chuvisco em vez de sumir da sala. */
  semSinal: boolean;
  totalDeCanais: number;
  canalAtivo: number;
  onTrocarCanal: (indice: number) => void;
  children: ReactNode;
}

/**
 * O aparelho: gabinete, tubo, e os efeitos de vidro por cima. É moldura — o conteúdo do canal
 * (título, sessão, botões) entra por `children`, porque quem sabe o que exibir é a página.
 */
export function TvDeTubo({
  posterUrl,
  semSinal,
  totalDeCanais,
  canalAtivo,
  onTrocarCanal,
  children,
}: TvDeTuboProps) {
  return (
    <section
      data-testid="hero-vitrine"
      className="flex justify-center border-b-[3px] border-ink-950 px-4 py-8 sm:px-6 sm:py-11"
      style={{
        backgroundImage: 'radial-gradient(120% 90% at 50% 0%, #2A2130 0%, #171219 60%, #100C13 100%)',
      }}
    >
      <div className="w-full max-w-[1080px]">
        <div
          className="relative p-[clamp(16px,4cqw,30px)] pb-[clamp(20px,5cqw,40px)]"
          style={{
            backgroundImage: 'linear-gradient(165deg, #6C6459 0%, #3B352F 45%, #221E1A 100%)',
            boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.18), 0 26px 60px rgba(0,0,0,0.55)',
            border: '3px solid #0D0A0F',
            borderRadius: 'clamp(22px,5cqw,46px) clamp(22px,5cqw,46px) clamp(14px,3cqw,30px) clamp(14px,3cqw,30px)',
          }}
        >
          {/* A borda do tubo encolhe no mobile: 12px de cada lado custam caro numa tela de 390px. */}
          <div
            className="relative animate-[rolo-flick_7s_infinite] overflow-hidden rounded-[28px] border-[8px] border-[#14100E] sm:border-[12px]"
            style={{ background: '#05060A', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)' }}
          >
            <div className="relative">
              {posterUrl && <PosterDoTubo key={posterUrl} url={posterUrl} />}
              {/* Chuvisco: o que um tubo mostra quando o canal não existe. `steps` em vez de
                  interpolação — estática de TV salta, não desliza. */}
              {semSinal && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.22]"
                  style={{
                    animation: 'rolo-chuvisco 0.4s steps(4, jump-none) infinite',
                    backgroundImage:
                      'repeating-linear-gradient(115deg, rgba(255,255,255,0.9) 0 1px, transparent 1px 3px), repeating-linear-gradient(63deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 4px)',
                    backgroundSize: '5px 5px, 7px 7px',
                  }}
                />
              )}
              {/* O véu horizontal só funciona quando o texto ocupa a metade esquerda. No mobile ele
                  atravessa a largura toda, então lá o escurecimento vem de cima pra baixo. */}
              <div
                className="pointer-events-none absolute inset-0 sm:hidden"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg, rgba(5,6,10,0.62) 0%, rgba(5,6,10,0.86) 42%, rgba(5,6,10,0.94) 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 hidden sm:block"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, rgba(5,6,10,0.94) 0%, rgba(5,6,10,0.72) 38%, rgba(5,6,10,0.1) 70%, rgba(126,217,242,0.12) 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 4px)',
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 h-[90px] animate-[rolo-scan_6s_linear_infinite] opacity-[0.16]"
                style={{ backgroundImage: 'linear-gradient(180deg, transparent, #7ED9F2, transparent)' }}
              />

              {/* O texto fica no fluxo (e é ele quem carrega o `min-h`), não em `absolute`: como
                  absoluto ele não empurrava altura nenhuma e um título longo em tela estreita era
                  cortado pelo `overflow-hidden` do tubo. O pôster atrás estica junto via `inset-0`.
                  O `pb` extra no mobile reserva a faixa das bolinhas de canal. */}
              {/* O mesmo `min-h` nos dois estados: é ele que segura a altura do documento quando
                  o filtro esvazia a grade, e é por isso que a rolagem não pula mais. */}
              <div className="relative flex min-h-[clamp(340px,92cqw,460px)] flex-col justify-center gap-[clamp(8px,1.4cqw,18px)] px-[clamp(16px,4cqw,56px)] py-8 pb-14 sm:pb-8">
                {children}
              </div>

              {!semSinal && totalDeCanais > 1 && (
                // A bolinha continua com 10px, mas quem recebe o toque é o botão de 24px em volta:
                // 10px é alvo pequeno demais pro dedo.
                <div className="absolute right-2 bottom-2 flex items-center sm:right-6 sm:bottom-3">
                  {Array.from({ length: totalDeCanais }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Destaque ${i + 1}`}
                      onClick={() => onTrocarCanal(i)}
                      className="grid h-6 w-6 place-items-center sm:h-7 sm:w-7"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border-2 border-paper-100"
                        style={{ background: i === canalAtivo ? '#FFC414' : 'transparent' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* A grade do alto-falante sai no mobile: ela e os botões não cabem na mesma linha
              numa tela estreita e o nome do aparelho fica espremido. */}
          <div className="mt-[18px] flex items-center justify-between gap-3 px-1 sm:px-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="hidden h-3 w-[62px] rounded-sm sm:block" style={{ background: '#14100E' }} />
              <div className="truncate font-mono text-base tracking-[2px] text-[#C9BCA9] sm:text-lg">
                ROLO 35 TRINITRON
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div
                className="h-[26px] w-[26px] rounded-full border-2"
                style={{ backgroundImage: 'linear-gradient(150deg, #8A8175, #423C35)', borderColor: '#14100E' }}
              />
              <div
                className="h-[26px] w-[26px] rounded-full border-2"
                style={{ backgroundImage: 'linear-gradient(150deg, #8A8175, #423C35)', borderColor: '#14100E' }}
              />
              <div
                aria-hidden
                className="h-2.5 w-2.5 animate-[rolo-blink_2.4s_infinite] rounded-full"
                style={{ background: '#E32B21', boxShadow: '0 0 10px #E32B21' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
