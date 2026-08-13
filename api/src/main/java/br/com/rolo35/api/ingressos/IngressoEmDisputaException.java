package br.com.rolo35.api.ingressos;

public class IngressoEmDisputaException extends RuntimeException {

    public IngressoEmDisputaException() {
        super("Ingresso em disputa no momento — tente novamente");
    }
}
