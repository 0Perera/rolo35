package br.com.rolo35.api.sessoes;

public class HoldAtivoException extends RuntimeException {

    public HoldAtivoException() {
        super("Sessão tem hold de reserva ativo — troque de sala só depois que ele expirar");
    }
}
