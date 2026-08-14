import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

interface OpcoesDoLeitor {
  /** Chamado uma vez por acionamento, com a câmera já desligada. */
  onLer: (codigo: string) => void;
  /** Enquanto responder `true`, leituras novas são descartadas sem desligar nada. */
  ocupado: () => boolean;
}

/**
 * Ciclo de vida da câmera do leitor de QR: ligar, desligar, desmontar e reportar falha de permissão.
 *
 * <p>Mora fora da página porque é a parte que precisa de imperativo — instanciar a biblioteca,
 * acoplar no `<video>` e destruir o objeto — no meio de uma tela que no resto é declarativa.
 */
export function useLeitorDeQr({ onLer, ocupado }: OpcoesDoLeitor) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [ligada, setLigada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Os dois vêm de dentro do render e mudam a cada um deles; o `onDecode` é criado uma vez só, na
  // hora do `start()`, e precisa enxergar a versão atual — não a que existia naquele render.
  const callbacks = useRef({ onLer, ocupado });
  callbacks.current = { onLer, ocupado };

  function desligar() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setLigada(false);
  }

  async function ligar() {
    if (!videoRef.current) {
      return;
    }
    setErro(null);
    // Liga antes do `start()` de propósito: o vídeo precisa estar visível pro getUserMedia
    // acoplar nele. Se o start falhar, o catch abaixo desfaz.
    setLigada(true);
    const scanner = new QrScanner(
      videoRef.current,
      (leitura) => {
        // O qr-scanner decodifica ~25×/s enquanto o QR estiver no enquadramento. Sem parar aqui,
        // o mesmo ingresso é validado dezenas de vezes: a 1ª volta VÁLIDO e as seguintes
        // JÁ UTILIZADO, invertendo o veredito na cara do operador. Uma leitura por acionamento.
        if (callbacks.current.ocupado()) {
          return;
        }
        desligar();
        callbacks.current.onLer(leitura.data);
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
      setLigada(false);
      setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador ou digite o código manualmente.');
    }
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
    };
  }, []);

  return { videoRef, ligada, erro, ligar, desligar };
}
