package br.com.rolo35.api.sessoes;

public class SessaoConflitanteException extends RuntimeException {

    public SessaoConflitanteException() {
        super("Já existe uma sessão nessa sala com horário conflitante");
    }
}
