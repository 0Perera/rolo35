package br.com.rolo35.api.sessoes;

public class DataHoraNoPassadoException extends RuntimeException {

    public DataHoraNoPassadoException() {
        super("Data e hora da sessão precisam estar no futuro");
    }
}
