package br.com.rolo35.api.sessoes.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.StatusAssento;
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
import org.springframework.transaction.annotation.Transactional;

/**
 * AC1-2-5 contra o banco de verdade: prova que {@code travarParaReserva()} trava e
 * devolve as linhas ordenadas por assento_id (mecanismo real de AD-3, evita deadlock
 * entre duas reservas concorrentes) e que {@code reivindicar()} escreve status/reserva_id/
 * expires_at só nas linhas pedidas, sem tocar nas demais.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ReservaAssentoLockRepositoryTest {

    private static final String NOME_SALA = "Sala lock (fixture)";
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

    @Autowired
    private ReservaRepository reservaRepository;

    private Long salaCriadaId;
    private Long sessaoCriadaId;
    private Long reservaCriadaId;

    @AfterEach
    void limpaFixture() {
        if (sessaoCriadaId != null) {
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessaoCriadaId));
        }
        if (reservaCriadaId != null) {
            reservaRepository.deleteById(reservaCriadaId);
        }
        if (sessaoCriadaId != null) {
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
                .titulo("Sessão lock (fixture)")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        return sessaoRepository.save(sessao);
    }

    @Test
    @Transactional
    void travarParaReservaDevolveLinhasOrdenadasPorAssentoIdIndependenteDaOrdemDeEntrada() {
        Sala sala = salaSalva(2, 2);
        salaCriadaId = sala.getId();
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();

        Assento a1 = assentoSalvo(sala.getId(), "A", 1);
        Assento a2 = assentoSalvo(sala.getId(), "A", 2);
        Assento a3 = assentoSalvo(sala.getId(), "B", 1);
        Assento a4 = assentoSalvo(sala.getId(), "B", 2);

        Sessao sessao = sessaoSalva(sala.getId(), organizadorId);
        sessaoCriadaId = sessao.getId();

        assentoSessaoRepository.saveAll(List.of(
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a2.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a3.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a4.getId()), StatusAssento.LIVRE, null, null)));

        List<Long> idsFornaOrdemDecrescente = List.of(a3.getId(), a1.getId());
        List<AssentoSessao> travados =
                assentoSessaoRepository.travarParaReserva(sessao.getId(), idsFornaOrdemDecrescente);

        assertThat(travados).hasSize(2);
        assertThat(travados.get(0).getId().getAssentoId()).isEqualTo(a1.getId());
        assertThat(travados.get(1).getId().getAssentoId()).isEqualTo(a3.getId());
    }

    @Test
    @Transactional
    void reivindicarAtualizaSoAsLinhasPedidasEDeixaAsDemaisLivres() {
        Sala sala = salaSalva(2, 2);
        salaCriadaId = sala.getId();
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();

        Assento a1 = assentoSalvo(sala.getId(), "A", 1);
        Assento a2 = assentoSalvo(sala.getId(), "A", 2);
        Assento a3 = assentoSalvo(sala.getId(), "B", 1);

        Sessao sessao = sessaoSalva(sala.getId(), organizadorId);
        sessaoCriadaId = sessao.getId();

        assentoSessaoRepository.saveAll(List.of(
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a2.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a3.getId()), StatusAssento.LIVRE, null, null)));

        LocalDateTime expiraEm = LocalDateTime.now().plusMinutes(10).withNano(0);
        Reserva reserva = reservaRepository.save(
                new Reserva(null, organizadorId, sessao.getId(), StatusReserva.ATIVA, Instant.now(), expiraEm));
        reservaCriadaId = reserva.getId();
        int linhasAfetadas = assentoSessaoRepository.reivindicar(
                sessao.getId(), List.of(a1.getId(), a2.getId()), reserva.getId(), expiraEm, LocalDateTime.now());
        assertThat(linhasAfetadas).isEqualTo(2);

        List<AssentoSessao> recarregado = assentoSessaoRepository.findByIdSessaoId(sessao.getId());

        AssentoSessao linhaA1 = recarregado.stream()
                .filter(a -> a.getId().getAssentoId().equals(a1.getId()))
                .findFirst()
                .orElseThrow();
        AssentoSessao linhaA2 = recarregado.stream()
                .filter(a -> a.getId().getAssentoId().equals(a2.getId()))
                .findFirst()
                .orElseThrow();
        AssentoSessao linhaA3 = recarregado.stream()
                .filter(a -> a.getId().getAssentoId().equals(a3.getId()))
                .findFirst()
                .orElseThrow();

        assertThat(linhaA1.getStatus()).isEqualTo(StatusAssento.RESERVADO);
        assertThat(linhaA1.getReservaId()).isEqualTo(reserva.getId());
        assertThat(linhaA1.getExpiresAt()).isEqualTo(expiraEm);

        assertThat(linhaA2.getStatus()).isEqualTo(StatusAssento.RESERVADO);
        assertThat(linhaA2.getReservaId()).isEqualTo(reserva.getId());
        assertThat(linhaA2.getExpiresAt()).isEqualTo(expiraEm);

        assertThat(linhaA3.getStatus()).isEqualTo(StatusAssento.LIVRE);
        assertThat(linhaA3.getReservaId()).isNull();
        assertThat(linhaA3.getExpiresAt()).isNull();
    }

    // Achado do code review da Story 3.2: o UPDATE de reivindicar() confiava cegamente que o
    // chamador já tinha validado disponibilidade — sem guarda de status no próprio SQL, um
    // call site futuro que pulasse a checagem prévia sobrescreveria um assento já vendido.
    @Test
    @Transactional
    void reivindicarNaoSobrescreveAssentoJaVendidoMesmoSemChecagemPrevia() {
        Sala sala = salaSalva(1, 2);
        salaCriadaId = sala.getId();
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();

        Assento a1 = assentoSalvo(sala.getId(), "A", 1);
        Assento a2 = assentoSalvo(sala.getId(), "A", 2);

        Sessao sessao = sessaoSalva(sala.getId(), organizadorId);
        sessaoCriadaId = sessao.getId();

        Reserva reservaVendida = reservaRepository.save(new Reserva(
                null, organizadorId, sessao.getId(), StatusReserva.CONFIRMADA, Instant.now(),
                LocalDateTime.now().minusMinutes(30)));
        assentoSessaoRepository.saveAll(List.of(
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), StatusAssento.VENDIDO, reservaVendida.getId(), null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a2.getId()), StatusAssento.LIVRE, null, null)));

        LocalDateTime expiraEm = LocalDateTime.now().plusMinutes(10).withNano(0);
        Reserva reservaNova = reservaRepository.save(
                new Reserva(null, organizadorId, sessao.getId(), StatusReserva.ATIVA, Instant.now(), expiraEm));
        reservaCriadaId = reservaNova.getId();

        int linhasAfetadas = assentoSessaoRepository.reivindicar(
                sessao.getId(), List.of(a1.getId(), a2.getId()), reservaNova.getId(), expiraEm, LocalDateTime.now());

        // Só o assento livre (a2) foi atualizado — a guarda de status no UPDATE recusou a linha
        // vendida (a1), mesmo sem nenhuma checagem prévia em Java protegendo essa chamada.
        assertThat(linhasAfetadas).isEqualTo(1);

        AssentoSessao linhaA1 = assentoSessaoRepository.findByIdSessaoId(sessao.getId()).stream()
                .filter(a -> a.getId().getAssentoId().equals(a1.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(linhaA1.getStatus()).isEqualTo(StatusAssento.VENDIDO);
        assertThat(linhaA1.getReservaId()).isEqualTo(reservaVendida.getId());
    }

    // Achado do code review da Story 3.2: editar() lia assento_sessao sem lock antes de checar
    // hold ativo e apagar — travarPorSessao() fecha essa corrida usando o mesmo mecanismo de
    // travarParaReserva (PESSIMISTIC_WRITE ordenado por assento_id, AD-3).
    @Test
    @Transactional
    void travarPorSessaoDevolveTodasAsLinhasDaSessaoOrdenadasPorAssentoId() {
        Sala sala = salaSalva(2, 2);
        salaCriadaId = sala.getId();
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();

        Assento a1 = assentoSalvo(sala.getId(), "A", 1);
        Assento a2 = assentoSalvo(sala.getId(), "A", 2);
        Assento a3 = assentoSalvo(sala.getId(), "B", 1);

        Sessao sessao = sessaoSalva(sala.getId(), organizadorId);
        sessaoCriadaId = sessao.getId();

        // Salvos fora de ordem de assento_id de propósito, pra provar que o ORDER BY da query
        // é quem garante a ordem, não a ordem de inserção.
        assentoSessaoRepository.saveAll(List.of(
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a3.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), StatusAssento.LIVRE, null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a2.getId()), StatusAssento.LIVRE, null, null)));

        List<AssentoSessao> travados = assentoSessaoRepository.travarPorSessao(sessao.getId());

        assertThat(travados).hasSize(3);
        assertThat(travados.get(0).getId().getAssentoId()).isEqualTo(a1.getId());
        assertThat(travados.get(1).getId().getAssentoId()).isEqualTo(a2.getId());
        assertThat(travados.get(2).getId().getAssentoId()).isEqualTo(a3.getId());
    }
}
