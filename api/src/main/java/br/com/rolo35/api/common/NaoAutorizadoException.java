package br.com.rolo35.api.common;

public class NaoAutorizadoException extends RuntimeException {

    public NaoAutorizadoException() {
        super("Você não tem permissão para acessar este recurso");
    }
}
