package br.com.rolo35.api.ingressos;

public class SessaoForaDaJanelaDoTurnoException extends RuntimeException {

    public SessaoForaDaJanelaDoTurnoException() {
        super("Sessão fora da janela permitida para o turno (-30min/+2h)");
    }
}
