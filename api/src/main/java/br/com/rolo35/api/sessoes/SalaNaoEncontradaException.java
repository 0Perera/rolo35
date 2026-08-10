package br.com.rolo35.api.sessoes;

public class SalaNaoEncontradaException extends RuntimeException {

    public SalaNaoEncontradaException() {
        super("Sala não encontrada");
    }
}
