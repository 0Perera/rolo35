package br.com.rolo35.api.ingressos;

public class IngressoNaoEncontradoException extends RuntimeException {

    public IngressoNaoEncontradoException() {
        super("Ingresso não encontrado");
    }
}
