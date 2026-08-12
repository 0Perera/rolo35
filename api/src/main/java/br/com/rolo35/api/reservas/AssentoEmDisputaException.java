package br.com.rolo35.api.reservas;

public class AssentoEmDisputaException extends RuntimeException {

    public AssentoEmDisputaException() {
        super("Assento em disputa no momento — tente novamente");
    }
}
