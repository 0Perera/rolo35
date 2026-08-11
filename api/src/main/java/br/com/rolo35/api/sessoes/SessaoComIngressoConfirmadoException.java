package br.com.rolo35.api.sessoes;

public class SessaoComIngressoConfirmadoException extends RuntimeException {

    public SessaoComIngressoConfirmadoException() {
        super("Sessão já tem ingresso confirmado — nenhum campo pode ser editado");
    }
}
