package br.com.rolo35.api.pagamentos;

public class ReservaExpiradaException extends RuntimeException {

    public ReservaExpiradaException() {
        super("Reserva expirada — refaça a seleção de assentos");
    }
}
