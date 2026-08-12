package br.com.rolo35.api.reservas;

public class SelecaoAssentosInvalidaException extends RuntimeException {

    public SelecaoAssentosInvalidaException() {
        super("Seleção precisa ter de 1 a 6 assentos, sem duplicados");
    }
}
