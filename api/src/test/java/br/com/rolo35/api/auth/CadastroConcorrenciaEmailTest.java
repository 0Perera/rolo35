package br.com.rolo35.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.auth.service.AuthService;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * AC2 contra o banco real. A checagem de duplicidade do `cadastrar()` (`findByEmail` antes do
 * INSERT) não é atômica com a gravação: com duas conexões de verdade, as duas podem consultar o
 * mesmo e-mail inexistente antes de qualquer uma gravar. Quem perde a corrida esbarra na constraint
 * `uk_usuarios_email`, e o que a AC2 promete pra esse caso é o mesmo 409 de sempre — nunca um 500.
 * Mocks não alcançam essa janela, daí o Testcontainers, no molde de
 * `ReservaConcorrenciaConflitoTest` e `PagamentoConcorrenciaConflitanteTest`.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class CadastroConcorrenciaEmailTest {

    private static final String EMAIL_DISPUTADO = "corrida@rolo35.com.br";

    @Autowired
    private AuthService authService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @AfterEach
    void limpaFixture() {
        usuarioRepository.findByEmail(EMAIL_DISPUTADO).ifPresent(usuarioRepository::delete);
    }

    @Test
    void exatamenteUmCadastroConcorrenteVenceQuandoDisputamOMesmoEmail() throws Exception {
        CadastroRequest request = new CadastroRequest("Fulano de Tal", EMAIL_DISPUTADO, "senha123", Papel.CLIENTE);

        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<LoginResponse> tarefa = () -> {
            barrier.await();
            return authService.cadastrar(request);
        };

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<LoginResponse> future1 = executor.submit(tarefa);
            Future<LoginResponse> future2 = executor.submit(tarefa);

            List<LoginResponse> sucessos = new ArrayList<>();
            List<Exception> falhas = new ArrayList<>();
            for (Future<LoginResponse> future : List.of(future1, future2)) {
                try {
                    sucessos.add(future.get());
                } catch (ExecutionException e) {
                    falhas.add((Exception) e.getCause());
                }
            }

            assertThat(sucessos).hasSize(1);
            assertThat(sucessos.get(0).papel()).isEqualTo("CLIENTE");
            assertThat(falhas).hasSize(1);
            // O ponto do teste: EmailJaCadastradoException (→ 409) e não uma
            // DataIntegrityViolationException crua (→ 500 pelo handler genérico).
            assertThat(falhas.get(0)).isInstanceOf(EmailJaCadastradoException.class);
        } finally {
            executor.shutdown();
        }

        assertThat(usuarioRepository.findAll().stream()
                        .filter(usuario -> EMAIL_DISPUTADO.equals(usuario.getEmail()))
                        .toList())
                .hasSize(1);
    }
}
