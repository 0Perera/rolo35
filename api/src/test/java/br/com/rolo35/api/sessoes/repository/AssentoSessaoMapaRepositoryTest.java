package br.com.rolo35.api.sessoes.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * AC1-2 contra o banco de verdade: prova que {@code buscarMapaPorSessao()} traz
 * assento + assento_sessao numa única consulta (sem N+1), com o shape puro (sem
 * lógica de TTL, que é responsabilidade do service), ordenado por fileira/numero.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class AssentoSessaoMapaRepositoryTest {

    private static final String NOME_SALA = "Sala mapa (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private AssentoRepository assentoRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Long salaCriadaId;
    private Long sessaoCriadaId;

    @AfterEach
    void limpaFixture() {
        if (sessaoCriadaId != null) {
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessaoCriadaId));
            sessaoRepository.deleteById(sessaoCriadaId);
        }
        if (salaCriadaId != null) {
            assentoRepository.deleteAll(assentoRepository.findBySalaId(salaCriadaId));
            salaRepository.deleteById(salaCriadaId);
        }
    }

    private Sala salaSalva(int linhas, int colunas) {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", NOME_SALA);
        ReflectionTestUtils.setField(sala, "linhas", linhas);
        ReflectionTestUtils.setField(sala, "colunas", colunas);
        return salaRepository.save(sala);
    }

    private Assento assentoSalvo(Long salaId, String fileira, int numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "salaId", salaId);
        ReflectionTestUtils.setField(assento, "fileira", fileira);
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assentoRepository.save(assento);
    }

    private Sessao sessaoSalva(Long salaId, Long organizadorId) {
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo("Sessão mapa (fixture)")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        return sessaoRepository.save(sessao);
    }

    @Test
    void buscarMapaPorSessaoTrazQuatroAssentosOrdenadosPorFileiraENumeroComStatusEExpiresAt() {
        Sala sala = salaSalva(2, 2);
        salaCriadaId = sala.getId();
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();

        Assento a1 = assentoSalvo(sala.getId(), "A", 1);
        Assento a2 = assentoSalvo(sala.getId(), "A", 2);
        Assento a3 = assentoSalvo(sala.getId(), "B", 1);
        Assento a4 = assentoSalvo(sala.getId(), "B", 2);

        Sessao sessao = sessaoSalva(sala.getId(), organizadorId);
        sessaoCriadaId = sessao.getId();

        LocalDateTime expiresFuturo = LocalDateTime.now().plusMinutes(5).withNano(0);
        LocalDateTime expiresPassado = LocalDateTime.now().minusMinutes(5).withNano(0);

        assentoSessaoRepository.saveAll(List.of(
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), "LIVRE", null, null),
                new AssentoSessao(
                        new AssentoSessaoId(sessao.getId(), a2.getId()), "RESERVADO", null, expiresFuturo),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a3.getId()), "VENDIDO", null, null),
                new AssentoSessao(
                        new AssentoSessaoId(sessao.getId(), a4.getId()), "RESERVADO", null, expiresPassado)));

        List<AssentoMapaProjection> mapa = assentoSessaoRepository.buscarMapaPorSessao(sessao.getId());

        assertThat(mapa).hasSize(4);

        assertThat(mapa.get(0).getAssentoId()).isEqualTo(a1.getId());
        assertThat(mapa.get(0).getFileira()).isEqualTo("A");
        assertThat(mapa.get(0).getNumero()).isEqualTo(1);
        assertThat(mapa.get(0).getStatus()).isEqualTo("LIVRE");
        assertThat(mapa.get(0).getExpiresAt()).isNull();

        assertThat(mapa.get(1).getAssentoId()).isEqualTo(a2.getId());
        assertThat(mapa.get(1).getFileira()).isEqualTo("A");
        assertThat(mapa.get(1).getNumero()).isEqualTo(2);
        assertThat(mapa.get(1).getStatus()).isEqualTo("RESERVADO");
        assertThat(mapa.get(1).getExpiresAt()).isEqualTo(expiresFuturo);

        assertThat(mapa.get(2).getAssentoId()).isEqualTo(a3.getId());
        assertThat(mapa.get(2).getFileira()).isEqualTo("B");
        assertThat(mapa.get(2).getNumero()).isEqualTo(1);
        assertThat(mapa.get(2).getStatus()).isEqualTo("VENDIDO");

        assertThat(mapa.get(3).getAssentoId()).isEqualTo(a4.getId());
        assertThat(mapa.get(3).getFileira()).isEqualTo("B");
        assertThat(mapa.get(3).getNumero()).isEqualTo(2);
        assertThat(mapa.get(3).getStatus()).isEqualTo("RESERVADO");
        assertThat(mapa.get(3).getExpiresAt()).isEqualTo(expiresPassado);
    }
}
