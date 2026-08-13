package br.com.rolo35.api.sessoes;

public class AssentoNaoEncontradoException extends RuntimeException {

    public AssentoNaoEncontradoException() {
        super("Assento não encontrado");
    }
}
