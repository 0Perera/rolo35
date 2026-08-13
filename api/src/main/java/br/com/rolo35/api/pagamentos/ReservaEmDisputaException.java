package br.com.rolo35.api.pagamentos;

public class ReservaEmDisputaException extends RuntimeException {

    public ReservaEmDisputaException() {
        super("Reserva em disputa no momento — tente novamente");
    }
}
