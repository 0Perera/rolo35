package br.com.rolo35.api.reservas;

public class AssentoIndisponivelException extends RuntimeException {

    public AssentoIndisponivelException() {
        super("Um ou mais assentos selecionados não estão mais disponíveis");
    }
}
