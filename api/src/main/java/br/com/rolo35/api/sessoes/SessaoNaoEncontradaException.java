package br.com.rolo35.api.sessoes;

public class SessaoNaoEncontradaException extends RuntimeException {

    public SessaoNaoEncontradaException() {
        super("Sessão não encontrada");
    }
}
