import type { PainelTurno } from '../api/portaria';

interface HistoricoDoTurnoProps {
  painel: PainelTurno | null;
  carregando: boolean;
  erro: boolean;
}

/**
 * Na coluna da direita, logo abaixo do veredito: o operador acompanha visor à esquerda e
 * resultado + histórico à direita sem tirar os olhos da fila. Embaixo da página, o histórico
 * só apareceria depois de rolar — inútil enquanto se escaneia.
 */
export function HistoricoDoTurno({ painel, carregando, erro }: HistoricoDoTurnoProps) {
  return (
    <div className="mt-8">
      <h2 className="font-mono text-xl tracking-[2px] text-paper-100/50">HISTÓRICO DA SESSÃO</h2>

      {carregando && <p className="mt-3 font-mono text-lg text-paper-100/60">Carregando histórico…</p>}

      {erro && (
        <p role="alert" className="mt-3 font-mono text-lg text-flame-400">
          Não foi possível carregar o histórico do turno.
        </p>
      )}

      {painel && painel.leituras.length === 0 && (
        <p className="mt-3 font-mono text-lg text-paper-100/60">Nenhuma entrada liberada nesta sessão ainda.</p>
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
                {new Date(leitura.validadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Dito na tela, não só no código: o operador não pode concluir que "não está na lista"
          significa "não tentou entrar". Recusa aparece na hora, mas não é gravada. */}
      <p className="mt-3 font-mono text-base tracking-wide text-paper-100/40">
        A lista mostra apenas entradas liberadas. Tentativas recusadas aparecem na leitura, mas não ficam registradas.
      </p>
    </div>
  );
}
