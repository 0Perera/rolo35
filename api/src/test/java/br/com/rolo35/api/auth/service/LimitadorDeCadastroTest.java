package br.com.rolo35.api.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import br.com.rolo35.api.auth.LimiteDeCadastroExcedidoException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LimitadorDeCadastroTest {

    private static final Duration JANELA = Duration.ofHours(1);
    private static final int TENTATIVAS = 3;
    private static final String IP = "203.0.113.7";

    private RelogioAjustavel relogio;
    private LimitadorDeCadastro limitador;

    @BeforeEach
    void setUp() {
        relogio = new RelogioAjustavel(Instant.parse("2026-08-14T10:00:00Z"));
        limitador = new LimitadorDeCadastro(TENTATIVAS, JANELA, relogio);
    }

    @Test
    void permiteAteOLimiteDentroDaJanela() {
        assertThatCode(() -> {
                    for (int i = 0; i < TENTATIVAS; i++) {
                        limitador.registrarTentativa(IP);
                    }
                })
                .doesNotThrowAnyException();
    }

    @Test
    void bloqueiaAPrimeiraTentativaAcimaDoLimite() {
        for (int i = 0; i < TENTATIVAS; i++) {
            limitador.registrarTentativa(IP);
        }

        assertThatExceptionOfType(LimiteDeCadastroExcedidoException.class)
                .isThrownBy(() -> limitador.registrarTentativa(IP));
    }

    /**
     * Insistir dentro da janela não pode reabrir a porta: a contagem continua subindo mesmo depois
     * de estourar, senão bastaria alternar entre tentativas pra ficar sempre na borda do limite.
     */
    @Test
    void continuaBloqueandoEnquantoAJanelaNaoVira() {
        for (int i = 0; i < TENTATIVAS + 1; i++) {
            registrarIgnorandoBloqueio(IP);
        }

        relogio.avancar(JANELA.minusMinutes(1));

        assertThatExceptionOfType(LimiteDeCadastroExcedidoException.class)
                .isThrownBy(() -> limitador.registrarTentativa(IP));
    }

    @Test
    void liberaDeNovoQuandoAJanelaVira() {
        for (int i = 0; i < TENTATIVAS + 1; i++) {
            registrarIgnorandoBloqueio(IP);
        }

        relogio.avancar(JANELA);

        assertThatCode(() -> limitador.registrarTentativa(IP)).doesNotThrowAnyException();
    }

    @Test
    void contagemEIndependentePorEndereco() {
        for (int i = 0; i < TENTATIVAS; i++) {
            limitador.registrarTentativa(IP);
        }

        assertThatCode(() -> limitador.registrarTentativa("198.51.100.2")).doesNotThrowAnyException();
    }

    /**
     * O mapa é memória do processo: sem descarte, uma varredura de endereços forjados o faz crescer
     * até derrubar a API — trocando um limite de cadastro por um vetor de negação de serviço.
     */
    @Test
    void descartaJanelasExpiradasEmVezDeCrescerSemLimite() {
        LimitadorDeCadastro limitadorComTeto = new LimitadorDeCadastro(TENTATIVAS, JANELA, relogio, 50);
        for (int i = 0; i < 50; i++) {
            limitadorComTeto.registrarTentativa("198.51.100." + i);
        }
        assertThat(limitadorComTeto.enderecosMonitorados()).isEqualTo(50);

        relogio.avancar(JANELA);
        limitadorComTeto.registrarTentativa("203.0.113.1");

        assertThat(limitadorComTeto.enderecosMonitorados()).isEqualTo(1);
    }

    /**
     * Descarte só pode levar janela vencida. Limpar uma janela ainda viva zeraria a contagem de quem
     * está no meio de um abuso — exatamente quem o limite existe pra conter.
     */
    @Test
    void descarteNaoLevaJanelaAindaViva() {
        LimitadorDeCadastro limitadorComTeto = new LimitadorDeCadastro(TENTATIVAS, JANELA, relogio, 50);
        for (int i = 0; i < 50; i++) {
            limitadorComTeto.registrarTentativa("198.51.100." + i);
        }

        limitadorComTeto.registrarTentativa("203.0.113.1");

        assertThat(limitadorComTeto.enderecosMonitorados()).isEqualTo(51);
    }

    private void registrarIgnorandoBloqueio(String ip) {
        try {
            limitador.registrarTentativa(ip);
        } catch (LimiteDeCadastroExcedidoException ignorado) {
            // O teste quer o estado depois das tentativas, não o resultado de cada uma.
        }
    }

    private static final class RelogioAjustavel extends Clock {

        private Instant agora;

        private RelogioAjustavel(Instant inicio) {
            this.agora = inicio;
        }

        private void avancar(Duration duracao) {
            agora = agora.plus(duracao);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }
}
