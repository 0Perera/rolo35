package br.com.rolo35.api.sessoes;

public class SessaoNaoPertenceAoOrganizadorException extends RuntimeException {

    public SessaoNaoPertenceAoOrganizadorException() {
        super("Esta sessão pertence a outro organizador");
    }
}
