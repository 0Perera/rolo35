package br.com.rolo35.api.reservas;

public class ClienteNaoEncontradoException extends RuntimeException {

    public ClienteNaoEncontradoException() {
        super("Usuário do token não existe mais");
    }
}
