package br.com.rolo35.api.sessoes;

/**
 * Sessão cujo horário já passou: não aceita mais reserva (FR-10) nem pagamento (FR-12).
 *
 * <p>Distinta de {@link DataHoraNoPassadoException}, que é sobre o <em>corpo</em> de uma criação ou
 * edição de sessão pedir uma data que não serve (400). Aqui o pedido está correto — é o estado do
 * mundo que mudou desde que a tela foi carregada, e por isso o status é 409.
 */
public class SessaoJaComecouException extends RuntimeException {

    public SessaoJaComecouException() {
        super("Sessão já começou");
    }
}
