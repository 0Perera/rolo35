package br.com.rolo35.api.auth;

public class LimiteDeCadastroExcedidoException extends RuntimeException {

    public LimiteDeCadastroExcedidoException() {
        super("Limite de cadastros excedido");
    }
}
