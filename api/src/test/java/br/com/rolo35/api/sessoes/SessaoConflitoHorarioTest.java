package br.com.rolo35.api.sessoes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * AC3 contra o banco de verdade: o buffer de 4h entre sessões da mesma sala é aritmética de
 * INTERVAL dentro de uma query nativa do Postgres — mockar {@code existeConflitante} testa o
 * caminho do service, não a regra. Aqui a regra é exercitada com horários diferentes, nos dois
 * sentidos da sobreposição e na fronteira exata do buffer.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SessaoConflitoHorarioTest {

    private static final String TITULO = "Conflito 4h (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";

    @Autowired
    private SessaoService sessaoService;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    @AfterEach
    void limpaSessoesDoTeste() {
        List<Sessao> criadas = sessaoRepository.findAll().stream()
                .filter(sessao -> TITULO.equals(sessao.getTitulo()))
                .toList();
        criadas.forEach(sessao -> assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessao.getId())));
        sessaoRepository.deleteAll(criadas);
    }

    private CriarSessaoRequest requestEm(Long salaId, LocalDateTime dataHora) {
        return new CriarSessaoRequest(
                salaId, 550L, TITULO, null, null, null, dataHora, new BigDecimal("25.00"));
    }

    @Test
    void bloqueiaSobreposicaoDentroDoBufferDeQuatroHorasEmAmbosOsSentidos() {
        Long salaId = salaRepository.findAll().get(0).getId();
        // Longe do seed (+7 dias) e do fixture do teste de concorrência (+30 dias).
        LocalDateTime base = LocalDateTime.now().plusDays(60).withNano(0);

        var criada = sessaoService.criar(requestEm(salaId, base), ORGANIZADOR);
        assertThat(criada.id()).isNotNull();

        assertThatThrownBy(() -> sessaoService.criar(requestEm(salaId, base.plusHours(3)), ORGANIZADOR))
                .isInstanceOf(SessaoConflitanteException.class);

        assertThatThrownBy(() -> sessaoService.criar(requestEm(salaId, base.minusHours(3)), ORGANIZADOR))
                .isInstanceOf(SessaoConflitanteException.class);
    }

    @Test
    void aceitaSessaoExatamenteNaFronteiraDoBuffer() {
        Long salaId = salaRepository.findAll().get(0).getId();
        LocalDateTime base = LocalDateTime.now().plusDays(90).withNano(0);

        sessaoService.criar(requestEm(salaId, base), ORGANIZADOR);

        // Buffer é intervalo aberto: exatamente 4h depois já não sobrepõe.
        var seguinte = sessaoService.criar(requestEm(salaId, base.plusHours(4)), ORGANIZADOR);

        assertThat(seguinte.id()).isNotNull();
        assertThat(sessaoRepository.findAll().stream()
                        .filter(sessao -> TITULO.equals(sessao.getTitulo()))
                        .count())
                .isEqualTo(2);
    }
}
