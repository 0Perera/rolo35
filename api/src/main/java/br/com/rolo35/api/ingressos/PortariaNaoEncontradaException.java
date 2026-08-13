package br.com.rolo35.api.ingressos;

public class PortariaNaoEncontradaException extends RuntimeException {

    public PortariaNaoEncontradaException() {
        super("Usuário do token não existe mais");
    }
}
