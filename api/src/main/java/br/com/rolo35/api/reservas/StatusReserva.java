package br.com.rolo35.api.reservas;

public enum StatusReserva {
    ATIVA,
    CONFIRMADA,
    /** Pagamento simulado recusado. Não confundir com {@link #CANCELADA}: aqui houve tentativa. */
    RECUSADA,
    /**
     * Hold abandonado pelo próprio cliente, ao reservar de novo na mesma sessão. Estado distinto de
     * {@code RECUSADA} de propósito — nunca houve pagamento, e misturar os dois faria o histórico
     * do cliente mostrar recusa que não aconteceu.
     */
    CANCELADA
}
