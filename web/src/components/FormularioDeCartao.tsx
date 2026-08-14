import type { ResultadoSimulado } from '../api/pagamentos';
import {
  formatarCvv,
  formatarNomeNoCartao,
  formatarNumeroCartao,
  formatarValidade,
  type DadosDoCartao,
} from '../lib/cartao';
import { formatarPreco } from '../lib/sessoes';
import { Alert } from './Alert';
import { Button } from './Button';
import { TextField } from './TextField';

const OPCOES_RESULTADO: { valor: ResultadoSimulado; rotulo: string }[] = [
  { valor: 'APROVADO', rotulo: 'APROVAR' },
  { valor: 'RECUSADO', rotulo: 'RECUSAR' },
];

// A máscara é aplicada no onChange, não só na validação do envio: o campo recusa o caractere no
// instante em que ele é digitado, em vez de aceitar qualquer coisa e reclamar no fim.
const MASCARAS: Record<keyof DadosDoCartao, (valor: string) => string> = {
  nome: formatarNomeNoCartao,
  numero: formatarNumeroCartao,
  validade: formatarValidade,
  cvv: formatarCvv,
};

interface FormularioDeCartaoProps {
  cartao: DadosDoCartao;
  onAlterar: (campo: keyof DadosDoCartao, valor: string) => void;
  resultado: ResultadoSimulado;
  onEscolherResultado: (resultado: ResultadoSimulado) => void;
  aviso: string;
  enviando: boolean;
  total: number;
  onConfirmar: () => void;
}

export function FormularioDeCartao({
  cartao,
  onAlterar,
  resultado,
  onEscolherResultado,
  aviso,
  enviando,
  total,
  onConfirmar,
}: FormularioDeCartaoProps) {
  function aoDigitar(campo: keyof DadosDoCartao) {
    return (evento: React.ChangeEvent<HTMLInputElement>) => onAlterar(campo, MASCARAS[campo](evento.target.value));
  }

  return (
    <section className="flex-[1_1_380px] border-[3px] border-ink-950 bg-paper-50 p-[clamp(20px,3cqw,30px)] shadow-[9px_9px_0_var(--color-ink-950)]">
      <h2 className="font-display text-xl">DADOS DO CARTÃO</h2>
      <div className="mt-3.5 mb-[22px] h-1 bg-gradient-to-r from-flame-600 to-flame-400" />

      {/* autoComplete="off" e nenhum autocomplete de cartão real (cc-number, cc-exp): o
          formulário é teatro da simulação, e convidar o navegador a guardar um cartão de
          verdade aqui seria pedir um dado que o sistema não tem por que ter. */}
      <TextField
        id="pagamento-nome"
        label="NOME NO CARTÃO"
        autoComplete="off"
        value={cartao.nome}
        onChange={aoDigitar('nome')}
      />
      <div className="mt-4">
        <TextField
          id="pagamento-numero"
          label="NÚMERO DO CARTÃO"
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          autoComplete="off"
          value={cartao.numero}
          onChange={aoDigitar('numero')}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3.5">
        <TextField
          id="pagamento-validade"
          label="VALIDADE"
          inputMode="numeric"
          placeholder="MM/AA"
          autoComplete="off"
          value={cartao.validade}
          onChange={aoDigitar('validade')}
        />
        <TextField
          id="pagamento-cvv"
          label="CVV"
          inputMode="numeric"
          placeholder="000"
          autoComplete="off"
          value={cartao.cvv}
          onChange={aoDigitar('cvv')}
        />
      </div>

      <div className="mt-6 border-t-2 border-dashed border-[#C7B694] pt-5">
        <p className="font-mono text-lg tracking-[2px] text-[#6D655B]">RESULTADO SIMULADO</p>
        <div className="mt-2.5 flex gap-2">
          {OPCOES_RESULTADO.map((opcao) => {
            const ativo = resultado === opcao.valor;
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => onEscolherResultado(opcao.valor)}
                className={`flex-1 cursor-pointer border-[3px] border-ink-950 px-2.5 py-3 font-mono text-lg tracking-wide ${
                  ativo
                    ? 'bg-gradient-to-r from-flame-600 to-flame-400 text-ink-950'
                    : 'bg-paper-100 text-ink-950/60 hover:bg-paper-50'
                }`}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {aviso && (
        <div className="mt-[18px]">
          <Alert>{aviso}</Alert>
        </div>
      )}

      <Button type="button" className="mt-[22px] w-full py-4 text-base" disabled={enviando} onClick={onConfirmar}>
        {enviando ? 'CONFIRMANDO…' : `CONFIRMAR PAGAMENTO · ${formatarPreco(total)}`}
      </Button>
    </section>
  );
}
