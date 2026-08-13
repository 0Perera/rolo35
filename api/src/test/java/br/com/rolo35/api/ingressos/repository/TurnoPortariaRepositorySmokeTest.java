package br.com.rolo35.api.ingressos.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class TurnoPortariaRepositorySmokeTest {

    private static final String TITULO_SESSAO_A = "Turno portaria sessão A (fixture)";
    private static final String TITULO_SESSAO_B = "Turno portaria sessão B (fixture)";

    @Autowired
    private TurnoPortariaRepository turnoPortariaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @AfterEach
    void limpaFixtures() {
        Usuario portaria = usuarioRepository.findByEmail("portaria@rolo35.com.br").orElseThrow();
        turnoPortariaRepository.deleteById(portaria.getId());
        List<Sessao> criadas = sessaoRepository.findAll().stream()
                .filter(sessao -> TITULO_SESSAO_A.equals(sessao.getTitulo()) || TITULO_SESSAO_B.equals(sessao.getTitulo()))
                .toList();
        sessaoRepository.deleteAll(criadas);
    }

    @Test
    void salvaBuscaEAtualizaTurnoDaMesmaPortaria() {
        Usuario portaria = usuarioRepository.findByEmail("portaria@rolo35.com.br").orElseThrow();
        Usuario organizador = usuarioRepository.findByEmail("organizador@rolo35.com.br").orElseThrow();
        Sessao sessaoA = sessaoRepository.save(novaSessao(TITULO_SESSAO_A, organizador.getId()));
        Sessao sessaoB = sessaoRepository.save(novaSessao(TITULO_SESSAO_B, organizador.getId()));

        turnoPortariaRepository.save(new TurnoPortaria(portaria.getId(), sessaoA.getId(), LocalDateTime.now()));

        Optional<TurnoPortaria> encontrado = turnoPortariaRepository.findById(portaria.getId());
        assertThat(encontrado).isPresent();
        assertThat(encontrado.get().getSessaoId()).isEqualTo(sessaoA.getId());

        turnoPortariaRepository.save(new TurnoPortaria(portaria.getId(), sessaoB.getId(), LocalDateTime.now()));

        List<TurnoPortaria> todos = turnoPortariaRepository.findAll();
        assertThat(todos.stream().filter(t -> t.getUsuarioId().equals(portaria.getId())).count()).isEqualTo(1);
        assertThat(turnoPortariaRepository.findById(portaria.getId()).orElseThrow().getSessaoId())
                .isEqualTo(sessaoB.getId());
    }

    @Test
    void rejeitaTurnoComUsuarioOuSessaoInexistente() {
        assertThatThrownBy(() -> turnoPortariaRepository.saveAndFlush(new TurnoPortaria(-1L, -1L, LocalDateTime.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Sessao novaSessao(String titulo, Long organizadorId) {
        return Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(1L)
                .tmdbId(550L)
                .titulo(titulo)
                .dataHora(LocalDateTime.now().plusDays(1))
                .preco(java.math.BigDecimal.TEN)
                .createdAt(Instant.now())
                .build();
    }
}
