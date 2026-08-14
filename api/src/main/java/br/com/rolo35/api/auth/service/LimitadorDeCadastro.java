package br.com.rolo35.api.auth.service;

import br.com.rolo35.api.auth.LimiteDeCadastroExcedidoException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Teto de cadastros por endereço de origem, em janela fixa.
 *
 * <p>Existe porque `POST /api/auth/cadastro` é a única rota pública que <em>cria</em> algo, e cria
 * conta com o papel que o corpo pedir — inclusive `PORTARIA`, que valida ingresso na entrada. As
 * demais rotas públicas do projeto são de leitura, e é por isso que a decisão de arquitetura de
 * deixar rate limiting fora do V1 não cobre esta: lá o abuso custa banda, aqui custa conta
 * privilegiada.
 *
 * <p><strong>Isto é atrito, não fronteira de segurança.</strong> Quem tiver muitos endereços passa
 * por cima, e o estado vive na memória de um processo só — reiniciar a API zera a contagem, e duas
 * instâncias contam separado. Conter abuso de verdade pede convite, verificação de e-mail ou
 * contador compartilhado; nada disso cabe no escopo desta story. O que este limite entrega é
 * encarecer a mineração casual de contas, que hoje custa zero.
 */
@Service
public class LimitadorDeCadastro {

    /**
     * Teto de endereços guardados ao mesmo tempo. O mapa é memória do processo: sem um limite, uma
     * varredura de endereços forjados o faz crescer até derrubar a API — trocaríamos um limite de
     * cadastro por um vetor de negação de serviço.
     */
    private static final int LIMITE_DE_ENDERECOS_MONITORADOS = 10_000;

    private final int tentativasPorJanela;
    private final Duration janela;
    private final Clock relogio;
    private final int limiteDeEnderecos;
    private final Map<String, Janela> janelasPorEndereco = new ConcurrentHashMap<>();

    // `@Autowired` explícito porque a classe tem mais de um construtor: os outros existem pra
    // injetar relógio e teto de memória nos testes, e sem a anotação o Spring desiste de escolher e
    // procura um construtor sem argumentos, que não existe.
    @Autowired
    public LimitadorDeCadastro(
            @Value("${cadastro.limite.tentativas:5}") int tentativasPorJanela,
            @Value("${cadastro.limite.janela-minutos:60}") long janelaMinutos) {
        this(tentativasPorJanela, Duration.ofMinutes(janelaMinutos), Clock.systemUTC());
    }

    LimitadorDeCadastro(int tentativasPorJanela, Duration janela, Clock relogio) {
        this(tentativasPorJanela, janela, relogio, LIMITE_DE_ENDERECOS_MONITORADOS);
    }

    LimitadorDeCadastro(int tentativasPorJanela, Duration janela, Clock relogio, int limiteDeEnderecos) {
        this.tentativasPorJanela = tentativasPorJanela;
        this.janela = janela;
        this.relogio = relogio;
        this.limiteDeEnderecos = limiteDeEnderecos;
    }

    /**
     * Conta a tentativa e lança quando o endereço passou do teto. Contar antes de decidir é
     * deliberado: quem insiste depois de bloqueado continua somando, então alternar tentativas não
     * mantém ninguém eternamente na borda do limite.
     */
    public void registrarTentativa(String endereco) {
        Instant agora = relogio.instant();
        descartarJanelasVencidas(agora);

        // `compute` porque ler-somar-gravar em três passos deixaria duas requisições simultâneas do
        // mesmo endereço gravarem a mesma contagem, e o limite viraria o dobro sob concorrência.
        Janela atual = janelasPorEndereco.compute(
                endereco,
                (chave, anterior) ->
                        anterior == null || anterior.venceu(agora, janela) ? new Janela(agora, 1) : anterior.mais());

        if (atual.tentativas() > tentativasPorJanela) {
            throw new LimiteDeCadastroExcedidoException();
        }
    }

    int enderecosMonitorados() {
        return janelasPorEndereco.size();
    }

    /**
     * Varre só quando o mapa encosta no teto: a varredura é O(n) e rodá-la a cada requisição pagaria
     * o custo sempre pra um problema que só aparece sob carga. Janela viva nunca é descartada —
     * limpá-la zeraria a contagem de quem está no meio de um abuso, que é justamente quem o limite
     * existe pra conter.
     */
    private void descartarJanelasVencidas(Instant agora) {
        if (janelasPorEndereco.size() >= limiteDeEnderecos) {
            janelasPorEndereco.values().removeIf(janelaGuardada -> janelaGuardada.venceu(agora, janela));
        }
    }

    private record Janela(Instant inicio, int tentativas) {

        private boolean venceu(Instant agora, Duration duracao) {
            return !agora.isBefore(inicio.plus(duracao));
        }

        private Janela mais() {
            return new Janela(inicio, tentativas + 1);
        }
    }
}
