package br.com.rolo35.api.sessoes;

public class SalaSemAssentosException extends RuntimeException {

    public SalaSemAssentosException() {
        super("Sala não tem mapa de assentos cadastrado");
    }
}
