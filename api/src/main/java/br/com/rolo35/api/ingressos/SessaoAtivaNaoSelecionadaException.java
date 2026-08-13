package br.com.rolo35.api.ingressos;

public class SessaoAtivaNaoSelecionadaException extends RuntimeException {

    public SessaoAtivaNaoSelecionadaException() {
        super("Selecione a sessão do turno antes de continuar");
    }
}
