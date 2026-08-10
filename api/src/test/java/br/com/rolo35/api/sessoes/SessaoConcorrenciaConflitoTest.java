package br.com.rolo35.api.sessoes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SessaoConcorrenciaConflitoTest {

    @Autowired
    private SessaoService sessaoService;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Test
    void exatamenteUmaCriacaoConcorrenteVenceQuandoHorarioSobrepoe() throws Exception {
        Long salaId = salaRepository.findAll().get(0).getId();
        LocalDateTime dataHora = LocalDateTime.now().plusDays(30).withNano(0);
        CriarSessaoRequest request = new CriarSessaoRequest(
                salaId, 550L, "Clube da Luta", null, null, null, dataHora, new BigDecimal("25.00"));

        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<Object> tarefa = () -> {
            barrier.await();
            return sessaoService.criar(request, "organizador@rolo35.com.br");
        };

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Object> future1 = executor.submit(tarefa);
            Future<Object> future2 = executor.submit(tarefa);

            List<Object> resultados = new ArrayList<>();
            List<Exception> falhas = new ArrayList<>();
            for (Future<Object> future : List.of(future1, future2)) {
                try {
                    resultados.add(future.get());
                } catch (ExecutionException e) {
                    falhas.add((Exception) e.getCause());
                }
            }

            assertThat(resultados).hasSize(1);
            assertThat(falhas).hasSize(1);
            assertThat(falhas.get(0)).isInstanceOf(SessaoConflitanteException.class);
        } finally {
            executor.shutdown();
        }

        long sessoesCriadas = sessaoRepository.findAll().stream()
                .filter(sessao -> sessao.getSalaId().equals(salaId) && sessao.getDataHora().equals(dataHora))
                .count();
        assertThat(sessoesCriadas).isEqualTo(1);
    }
}
