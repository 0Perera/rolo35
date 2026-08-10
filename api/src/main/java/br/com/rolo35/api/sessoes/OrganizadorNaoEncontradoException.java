package br.com.rolo35.api.sessoes;

public class OrganizadorNaoEncontradoException extends RuntimeException {

    public OrganizadorNaoEncontradoException() {
        super("Usuário do token não existe mais");
    }
}
