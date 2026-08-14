import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import QrScanner from 'qr-scanner';
import {
  buscarPainelTurno,
  buscarSessaoAtiva,
  validarIngresso,
  type PainelTurno,
  type ResultadoValidacao,
  type SessaoAtiva,
} from '../api/portaria';
import { ApiRequestError } from '../api/client';
import { buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';

// O vermelho da marca (`flame-600`, #E32B21) sobre o fundo escuro do veredito fica em ~3.4:1:
// passa no título de 30px, não passa no rótulo em VT323. Este é o mesmo tom clareado o
// suficiente pra servir aos dois — é o único desvio de cor em relação ao protótipo.
const VERMELHO_TERMINAL = '#ff5347';

/** Par borda//fundo de cada veredito, nos valores do protótipo. */
const VEREDITO: Record<ResultadoValidacao['resultado'], { cor: string; fundo: string }> = {
  VALIDO: { cor: '#8fe04a', fundo: '#12200e' },
  JA_UTILIZADO: { cor: '#ffc414', fundo: '#241c08' },
  INVALIDO: { cor: VERMELHO_TERMINAL, fundo: '#240c0c' },
  EVENTO_ERRADO: { cor: VERMELHO_TERMINAL, fundo: '#240c0c' },
};

const ROTULOS: Record<ResultadoValidacao['resultado'], string> = {
  VALIDO: 'VÁLIDO — LIBERAR ENTRADA',
  INVALIDO: 'INVÁLIDO',
  JA_UTILIZADO: 'JÁ UTILIZADO',
  EVENTO_ERRADO: 'EVENTO ERRADO',
};

/** Legenda dentro do visor, no lugar da imagem da câmera. */
const STATUS_SCANNER: Record<ResultadoValidacao['resultado'], string> = {
  VALIDO: 'LIDO COM SUCESSO',
  INVALIDO: 'QR NÃO RECONHECIDO',
  JA_UTILIZADO: 'TICKET REPETIDO',
  EVENTO_ERRADO: 'OUTRA SESSÃO',
};

function formatarHora(dataHora: string): string {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const VISOR_FUNDO = { backgroundImage: 'radial-gradient(circle at 50% 45%, #16222b 0%, #06080c 75%)' };

const VISOR_SCANLINES = {
  backgroundImage:
    'repeating-linear-gradient(0deg, rgba(126,217,242,0.18) 0px, rgba(126,217,242,0.18) 1px, transparent 1px, transparent 4px)',
};

const CANTOS = [
  'top-[14%] left-[14%] border-t-[5px] border-l-[5px]',
  'top-[14%] right-[14%] border-t-[5px] border-r-[5px]',
  'bottom-[14%] left-[14%] border-b-[5px] border-l-[5px]',
  'bottom-[14%] right-[14%] border-b-[5px] border-r-[5px]',
];

export function ValidacaoPortariaPage() {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [cameraLigada, setCameraLigada] = useState(false);
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoAtiva | null>(null);
  const [painel, setPainel] = useState<PainelTurno | null>(null);
  const [painelCarregando, setPainelCarregando] = useState(true);
  const [painelErro, setPainelErro] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  // Ref, não estado: o `onDecode` do qr-scanner dispara em loop e precisa enxergar o valor atual
  // na hora, não o do render em que o callback foi criado.
  const validandoRef = useRef(false);

  function desligarCamera() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCameraLigada(false);
  }

  function recarregarPainel() {
    setPainelErro(false);
    return buscarPainelTurno()
      .then(setPainel)
      .catch(() => setPainelErro(true))
      .finally(() => setPainelCarregando(false));
  }

  async function validar(codigoLido: string) {
    validandoRef.current = true;
    setValidando(true);
    setErro(null);
    // O veredito anterior tem que sumir antes do próximo: numa tela de portaria, um "VÁLIDO"
    // remanescente ao lado do erro do ingresso seguinte lê como liberação de quem não passou.
    setResultado(null);
    try {
      const resultado = await validarIngresso(codigoLido);
      setResultado(resultado);
      // Só depois de uma entrada liberada o painel muda. Recarregar em recusa gastaria uma
      // requisição pra redesenhar exatamente os mesmos números na frente da fila.
      if (resultado.resultado === 'VALIDO') {
        recarregarPainel();
      }
    } catch (erro) {
      if (erro instanceof ApiRequestError && erro.codigo === 'SESSAO_ATIVA_NAO_SELECIONADA') {
        setErro('Nenhuma sessão selecionada — volte e escolha a sessão do turno antes de validar.');
      } else {
        setErro('Não foi possível validar o ingresso agora. Tente novamente.');
      }
    } finally {
      validandoRef.current = false;
      setValidando(false);
    }
  }

  function validarManual() {
    if (codigo.trim().length === 0 || validandoRef.current) {
      return;
    }
    validar(codigo.trim());
  }

  async function ligarCamera() {
    if (!videoRef.current) {
      return;
    }
    setErroCamera(null);
    // Liga antes do `start()` de propósito: o vídeo precisa estar visível pro getUserMedia
    // acoplar nele. Se o start falhar, o catch abaixo desfaz.
    setCameraLigada(true);
    const scanner = new QrScanner(
      videoRef.current,
      (resultadoLeitura) => {
        // O qr-scanner decodifica ~25×/s enquanto o QR estiver no enquadramento. Sem parar aqui,
        // o mesmo ingresso é validado dezenas de vezes: a 1ª volta VÁLIDO e as seguintes
        // JÁ UTILIZADO, invertendo o veredito na cara do operador. Uma leitura por acionamento.
        if (validandoRef.current) {
          return;
        }
        desligarCamera();
        validar(resultadoLeitura.data);
      },
      // A moldura de leitura é desenhada pela própria tela (cantos amarelos + linha varrendo);
      // ligar o destaque da biblioteca sobreporia um segundo quadro por cima do nosso.
      { highlightScanRegion: false },
    );
    scannerRef.current = scanner;
    try {
      await scanner.start();
    } catch {
      scanner.destroy();
      scannerRef.current = null;
      setCameraLigada(false);
      setErroCamera(
        'Não foi possível abrir a câmera. Verifique a permissão do navegador ou digite o código manualmente.',
      );
    }
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
    };
  }, []);

  // Qual sessão está sendo validada é a informação mais importante da tela: sem ela, o operador
  // não tem como saber se o "EVENTO ERRADO" que apareceu é do ingresso ou do turno errado.
  useEffect(() => {
    let ativo = true;
    buscarSessaoAtiva()
      .then((resultado) => {
        if (ativo) {
          setSessaoAtiva(resultado);
        }
      })
      .catch(() => {
        // O cabeçalho perde o nome da sessão, mas a validação em si não depende dele — o back
        // resolve a sessão do turno por conta própria a cada leitura.
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    buscarPainelTurno()
      .then((resultado) => {
        if (ativo) {
          setPainel(resultado);
        }
      })
      .catch(() => {
        if (ativo) {
          setPainelErro(true);
        }
      })
      .finally(() => {
        if (ativo) {
          setPainelCarregando(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  const statusVisor = validando
    ? 'LENDO…'
    : resultado
      ? STATUS_SCANNER[resultado.resultado]
      : 'APROXIME O QR CODE';

  return (
    <PageShell variant="terminal">
      <div className="mx-auto max-w-[1080px] px-5 py-11 pb-20 sm:px-8">
        <Link to="/portaria" className="font-mono text-lg tracking-wide text-paper-100/60 hover:text-cyan-400">
          ◀ TROCAR SESSÃO
        </Link>

        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-5">
          <SectionTitle kicker="TERMINAL DE PORTARIA" tone="terminal">
            LEITOR DE QR
          </SectionTitle>

          <div className="font-mono text-xl tracking-wide sm:text-right">
            {sessaoAtiva && (
              <p className="text-paper-100/80">
                SESSÃO {formatarHora(sessaoAtiva.dataHora)} · {sessaoAtiva.titulo.toUpperCase()}
              </p>
            )}
            {painel && (
              <p className="text-cyan-400">
                {/* Sobre ingressos emitidos, não sobre a capacidade da sala: numa sessão de 62
                    vendidos, "37/120" leria como sala vazia com 60% do público já dentro. */}
                VALIDADOS {painel.validados} / {painel.emitidos}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] items-start gap-8">
          <section className="border-[3px] border-cyan-400 bg-[#06080c] p-[22px]">
            <div className="relative aspect-square overflow-hidden" style={VISOR_FUNDO}>
              <video
                ref={videoRef}
                className={cameraLigada ? 'absolute inset-0 h-full w-full object-cover' : 'hidden'}
              />
              <div aria-hidden className="pointer-events-none absolute inset-0" style={VISOR_SCANLINES} />
              <div
                aria-hidden
                className="pointer-events-none absolute right-[14%] left-[14%] h-[3px] bg-flame-600 shadow-[0_0_14px_var(--color-flame-600)] motion-safe:animate-[rolo-scan_3.2s_linear_infinite]"
              />
              {CANTOS.map((canto) => (
                <div key={canto} aria-hidden className={`pointer-events-none absolute h-[54px] w-[54px] border-flame-400 ${canto}`} />
              ))}
              {!cameraLigada && (
                <div className="absolute inset-0 grid place-items-center px-6 text-center font-mono text-[22px] tracking-[2px] text-cyan-400">
                  {statusVisor}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={cameraLigada ? desligarCamera : ligarCamera}
              className="mt-5 w-full border-[3px] border-flame-400 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400 p-4 font-display text-base text-ink-950 hover:brightness-110"
            >
              {cameraLigada ? 'DESLIGAR CÂMERA' : 'LIGAR CÂMERA'}
            </button>

            {erroCamera && (
              <p role="alert" className="mt-3 font-mono text-lg text-flame-400">
                {erroCamera}
              </p>
            )}
          </section>

          <section>
            <label className="block font-mono text-lg tracking-[2px] text-cyan-400" htmlFor="codigo-ingresso">
              Código do ingresso
            </label>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <input
                id="codigo-ingresso"
                type="text"
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value)}
                className="min-w-0 flex-1 border-[3px] border-cyan-400 bg-ink-800 px-3 py-2.5 font-mono text-lg text-paper-100"
              />
              <button type="button" onClick={validarManual} disabled={validando} className={buttonClass('secondary')}>
                VALIDAR
              </button>
            </div>

            {erro && (
              <p role="alert" className="mt-4 font-mono text-lg text-flame-400">
                {erro}
              </p>
            )}

            {resultado && (
              <div
                className="mt-6 border-[3px] p-6"
                style={{
                  borderColor: VEREDITO[resultado.resultado].cor,
                  backgroundColor: VEREDITO[resultado.resultado].fundo,
                }}
              >
                <p className="font-mono text-lg tracking-[2px]" style={{ color: VEREDITO[resultado.resultado].cor }}>
                  ÚLTIMA LEITURA
                </p>
                <p
                  className="mt-2 font-display text-[clamp(20px,3.4cqw,30px)] leading-tight"
                  style={{ color: VEREDITO[resultado.resultado].cor }}
                >
                  {ROTULOS[resultado.resultado]}
                </p>

                <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3.5 font-mono text-lg text-paper-100/70">
                  {resultado.assentoFileira && resultado.assentoNumero && (
                    <p>
                      Assento{' '}
                      <span className="block text-white">
                        {resultado.assentoFileira}
                        {resultado.assentoNumero}
                      </span>
                    </p>
                  )}
                  {/* Rotulado de propósito: o título aqui é o da sessão do *turno*, não a do ingresso.
                      Sem o rótulo, o operador lê "EVENTO ERRADO / Clube da Luta" segurando um ingresso
                      de outro filme e conclui o oposto do que a resposta quis dizer. */}
                  {resultado.sessaoTitulo && (
                    <p>
                      Sessão do turno:{' '}
                      <span className="block text-white">{resultado.sessaoTitulo}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Na coluna da direita, logo abaixo do veredito: o operador acompanha visor à
                esquerda e resultado + histórico à direita sem tirar os olhos da fila. Embaixo da
                página, o histórico só aparece depois de rolar — inútil enquanto se escaneia. */}
            <div className="mt-8">
              <h2 className="font-mono text-xl tracking-[2px] text-paper-100/50">HISTÓRICO DA SESSÃO</h2>

              {painelCarregando && <p className="mt-3 font-mono text-lg text-paper-100/60">Carregando histórico…</p>}

              {painelErro && (
                <p role="alert" className="mt-3 font-mono text-lg text-flame-400">
                  Não foi possível carregar o histórico do turno.
                </p>
              )}

              {painel && painel.leituras.length === 0 && (
                <p className="mt-3 font-mono text-lg text-paper-100/60">
                  Nenhuma entrada liberada nesta sessão ainda.
                </p>
              )}

              {painel && painel.leituras.length > 0 && (
                <ul className="mt-3 flex max-h-[420px] flex-col gap-2 overflow-y-auto">
                  {painel.leituras.map((leitura) => (
                    <li
                      key={leitura.codigoCurto + leitura.validadoEm}
                      className="flex items-center gap-3.5 border-2 border-ink-700 bg-ink-950 px-4 py-3 font-mono text-lg tracking-wide"
                    >
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#8fe04a]" />
                      <span className="w-[86px] shrink-0 text-paper-100/70">{leitura.codigoCurto}</span>
                      <span className="w-[52px] shrink-0 text-white">
                        {leitura.assentoFileira}
                        {leitura.assentoNumero}
                      </span>
                      <span className="flex-1 text-[#8fe04a]">ENTROU</span>
                      <span className="text-paper-100/50">
                        {new Date(leitura.validadoEm).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Dito na tela, não só no código: o operador não pode concluir que "não está na
                  lista" significa "não tentou entrar". Recusa aparece na hora, mas não é gravada. */}
              <p className="mt-3 font-mono text-base tracking-wide text-paper-100/40">
                A lista mostra apenas entradas liberadas. Tentativas recusadas aparecem na leitura, mas não ficam
                registradas.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
