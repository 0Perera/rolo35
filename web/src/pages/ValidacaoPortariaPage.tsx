import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { validarIngresso, type ResultadoValidacao } from '../api/portaria';
import { ApiRequestError } from '../api/client';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';

const CORES: Record<ResultadoValidacao['resultado'], string> = {
  VALIDO: '#2E7D46',
  INVALIDO: '#E32B21',
  EVENTO_ERRADO: '#E32B21',
  JA_UTILIZADO: '#F26522',
};

const ROTULOS: Record<ResultadoValidacao['resultado'], string> = {
  VALIDO: 'VÁLIDO — LIBERAR ENTRADA',
  INVALIDO: 'INVÁLIDO',
  JA_UTILIZADO: 'JÁ UTILIZADO',
  EVENTO_ERRADO: 'EVENTO ERRADO',
};

export function ValidacaoPortariaPage() {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [cameraLigada, setCameraLigada] = useState(false);

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
      { highlightScanRegion: true },
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

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        <SectionTitle kicker="PORTARIA">VALIDAR INGRESSO</SectionTitle>

        <div className="mt-8 flex flex-col gap-3">
          <label className="font-mono text-lg tracking-wide text-ink-950/60" htmlFor="codigo-ingresso">
            Código do ingresso
          </label>
          <div className="flex gap-3">
            <input
              id="codigo-ingresso"
              type="text"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              className="flex-1 border-[3px] border-ink-950 bg-paper-50 px-3 py-2.5 font-mono text-lg"
            />
            <button
              type="button"
              onClick={validarManual}
              disabled={validando}
              className="border-[3px] border-ink-950 bg-paper-50 px-5 py-3 font-display text-sm tracking-wide shadow-[5px_5px_0_var(--color-cyan-400)] disabled:opacity-60"
            >
              VALIDAR
            </button>
          </div>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={cameraLigada ? desligarCamera : ligarCamera}
            className="border-[3px] border-ink-950 bg-paper-50 px-5 py-3 font-display text-sm tracking-wide shadow-[5px_5px_0_var(--color-ink-950)]"
          >
            {cameraLigada ? 'DESLIGAR CÂMERA' : 'LIGAR CÂMERA'}
          </button>
          {erroCamera && (
            <p role="alert" className="mt-3 font-mono text-lg text-flame-600">
              {erroCamera}
            </p>
          )}
          <video ref={videoRef} className={cameraLigada ? 'mt-4 w-full border-[3px] border-ink-950' : 'hidden'} />
        </div>

        {validando && <p className="mt-6 font-mono text-lg text-ink-950/60">Validando…</p>}

        {erro && (
          <p role="alert" className="mt-6 font-mono text-lg text-flame-600">
            {erro}
          </p>
        )}

        {resultado && (
          <div
            className="mt-6 border-[3px] border-ink-950 p-5 shadow-[6px_6px_0_var(--color-ink-950)]"
            style={{ backgroundColor: CORES[resultado.resultado] }}
          >
            <p className="font-display text-2xl text-paper-50">{ROTULOS[resultado.resultado]}</p>
            {/* Rotulado de propósito: o título aqui é o da sessão do *turno*, não a do ingresso.
                Sem o rótulo, o operador lê "EVENTO ERRADO / Clube da Luta" segurando um ingresso
                de outro filme e conclui o oposto do que a resposta quis dizer. */}
            {resultado.sessaoTitulo && (
              <p className="mt-1 font-mono text-base text-paper-50">
                Sessão do turno: {resultado.sessaoTitulo}
              </p>
            )}
            {resultado.assentoFileira && resultado.assentoNumero && (
              <p className="mt-1 font-mono text-base text-paper-50">
                Assento {resultado.assentoFileira}
                {resultado.assentoNumero}
              </p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
