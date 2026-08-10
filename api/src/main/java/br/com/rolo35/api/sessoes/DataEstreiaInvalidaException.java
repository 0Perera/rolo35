package br.com.rolo35.api.sessoes;

public class DataEstreiaInvalidaException extends RuntimeException {

    public DataEstreiaInvalidaException() {
        super("Data de estreia precisa estar no formato AAAA-MM-DD");
    }
}
