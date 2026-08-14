import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
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
import { HistoricoDoTurno } from '../components/HistoricoDoTurno';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { VereditoDaLeitura } from '../components/VereditoDaLeitura';
import { VisorDoScanner } from '../components/VisorDoScanner';
import { useLeitorDeQr } from '../lib/leitorQr';

function formatarHora(dataHora: string): string {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ValidacaoPortariaPage() {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoAtiva | null>(null);
  const [painel, setPainel] = useState<PainelTurno | null>(null);
  const [painelCarregando, setPainelCarregando] = useState(true);
  const [painelErro, setPainelErro] = useState(false);

  // Ref, não estado: o `onDecode` do qr-scanner dispara em loop e precisa enxergar o valor atual
  // na hora, não o do render em que o callback foi criado.
  const validandoRef = useRef(false);

  const camera = useLeitorDeQr({
    onLer: (codigoLido) => validar(codigoLido),
    ocupado: () => validandoRef.current,
  });

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
          <VisorDoScanner
            videoRef={camera.videoRef}
            cameraLigada={camera.ligada}
            validando={validando}
            resultado={resultado}
            erroCamera={camera.erro}
            onAlternarCamera={camera.ligada ? camera.desligar : camera.ligar}
          />

          <section>
            <label className="block font-mono text-lg tracking-[2px] text-cyan-400" htmlFor="codigo-ingresso">
              Código do ingresso
            </label>
            {/* O código curto existe pro caso em que a câmera não é opção. Dizer isso aqui é o que
                transforma o campo num plano B usável em vez de um campo pra colar 60 caracteres. */}
            <p className="mt-1 font-mono text-base tracking-wide text-paper-100/50">
              OS 8 CARACTERES DO CANHOTO, OU O CÓDIGO COMPLETO DO QR
            </p>
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

            {resultado && <VereditoDaLeitura resultado={resultado} />}

            <HistoricoDoTurno painel={painel} carregando={painelCarregando} erro={painelErro} />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
