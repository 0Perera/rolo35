package br.com.rolo35.api.ingressos.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.StatusAssento;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class IngressoLeituraRepositoryTest {

    /**
     * Código curto de fixture. A emissão real usa SecureRandom; aqui o valor só precisa ser
     * único (a coluna é UNIQUE) e caber no alfabeto Base32 Crockford de 8 caracteres.
     */
    private static String codigoCurtoDeTeste() {
        return java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private static final String CLIENTE_1 = "cliente1@rolo35.com.br";
    private static final String CLIENTE_2 = "cliente2@rolo35.com.br";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";

    @Autowired
    private IngressoRepository ingressoRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private AssentoRepository assentoRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    private Long salaCriadaId;
    private Long sessaoCriadaId;
    private Long outraSessaoCriadaId;
    private Long reserva1Id;
    private Long reserva2Id;

    @AfterEach
    void limpaFixture() {
        if (reserva1Id != null) {
            ingressoRepository.deleteAll(ingressoRepository.findByReservaId(reserva1Id));
            reservaRepository.deleteById(reserva1Id);
        }
        if (reserva2Id != null) {
            ingressoRepository.deleteAll(ingressoRepository.findByReservaId(reserva2Id));
            reservaRepository.deleteById(reserva2Id);
        }
        if (outraSessaoCriadaId != null) {
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(outraSessaoCriadaId));
            sessaoRepository.deleteById(outraSessaoCriadaId);
        }
        if (sessaoCriadaId != null) {
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessaoCriadaId));
            sessaoRepository.deleteById(sessaoCriadaId);
        }
        if (salaCriadaId != null) {
            assentoRepository.deleteAll(assentoRepository.findBySalaId(salaCriadaId));
            salaRepository.deleteById(salaCriadaId);
        }
    }

    @Test
    void buscarPorClienteRetornaSoOsIngressosDaReservaDaqueleCliente() {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", "Sala ingressos leitura (fixture)");
        ReflectionTestUtils.setField(sala, "linhas", 1);
        ReflectionTestUtils.setField(sala, "colunas", 2);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();

        Assento a1 = new Assento();
        ReflectionTestUtils.setField(a1, "salaId", sala.getId());
        ReflectionTestUtils.setField(a1, "fileira", "A");
        ReflectionTestUtils.setField(a1, "numero", 1);
        a1 = assentoRepository.save(a1);

        Assento a2 = new Assento();
        ReflectionTestUtils.setField(a2, "salaId", sala.getId());
        ReflectionTestUtils.setField(a2, "fileira", "A");
        ReflectionTestUtils.setField(a2, "numero", 2);
        a2 = assentoRepository.save(a2);

        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(sala.getId())
                .tmdbId(550L)
                .titulo("Sessão ingressos leitura (fixture)")
                .posterUrl("https://image.tmdb.org/poster.jpg")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessao = sessaoRepository.save(sessao);
        sessaoCriadaId = sessao.getId();
        mapeiaNaSessao(sessao.getId(), a1, a2);

        Long cliente1Id = usuarioRepository.findByEmail(CLIENTE_1).orElseThrow().getId();
        Long cliente2Id = usuarioRepository.findByEmail(CLIENTE_2).orElseThrow().getId();

        Reserva reserva1 = reservaRepository.save(new Reserva(
                null, cliente1Id, sessao.getId(), StatusReserva.CONFIRMADA, Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva1Id = reserva1.getId();
        Reserva reserva2 = reservaRepository.save(new Reserva(
                null, cliente2Id, sessao.getId(), StatusReserva.CONFIRMADA, Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva2Id = reserva2.getId();

        ingressoRepository.save(new Ingresso(null, reserva1.getId(), a1.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, Instant.now().truncatedTo(ChronoUnit.MICROS)));
        ingressoRepository.save(new Ingresso(null, reserva2.getId(), a2.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, Instant.now().truncatedTo(ChronoUnit.MICROS)));

        List<IngressoResumoProjection> resultado =
                ingressoRepository.buscarPorCliente(cliente1Id, Pageable.unpaged()).getContent();

        assertThat(resultado).hasSize(1);
        IngressoResumoProjection projecao = resultado.get(0);
        assertThat(projecao.getAssentoFileira()).isEqualTo("A");
        assertThat(projecao.getAssentoNumero()).isEqualTo(1);
        assertThat(projecao.getSessaoTitulo()).isEqualTo("Sessão ingressos leitura (fixture)");
        assertThat(projecao.getSalaNome()).isEqualTo("Sala ingressos leitura (fixture)");
        assertThat(projecao.getStatus()).isEqualTo(StatusIngresso.VALIDO);
    }

    @Test
    void buscarPorClientePaginaSemVazarIngressoDeOutroCliente() {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", "Sala paginação (fixture)");
        ReflectionTestUtils.setField(sala, "linhas", 1);
        ReflectionTestUtils.setField(sala, "colunas", 3);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();

        Assento a1 = novoAssento(sala.getId(), 1);
        Assento a2 = novoAssento(sala.getId(), 2);
        Assento a3 = novoAssento(sala.getId(), 3);

        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(sala.getId())
                .tmdbId(550L)
                .titulo("Sessão paginação (fixture)")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessao = sessaoRepository.save(sessao);
        sessaoCriadaId = sessao.getId();
        mapeiaNaSessao(sessao.getId(), a1, a2, a3);

        Long cliente1Id = usuarioRepository.findByEmail(CLIENTE_1).orElseThrow().getId();
        Long cliente2Id = usuarioRepository.findByEmail(CLIENTE_2).orElseThrow().getId();
        Reserva reserva1 = reservaRepository.save(new Reserva(
                null, cliente1Id, sessao.getId(), StatusReserva.CONFIRMADA,
                Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva1Id = reserva1.getId();
        Reserva reserva2 = reservaRepository.save(new Reserva(
                null, cliente2Id, sessao.getId(), StatusReserva.CONFIRMADA,
                Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva2Id = reserva2.getId();

        // Os dois do cliente 1 compartilham `createdAt` de propósito: é o que a emissão em lote
        // produz quando dois `save()` caem no mesmo microssegundo. Sem desempate estável, a mesma
        // linha pode voltar em duas páginas e outra sumir.
        Instant mesmoInstante = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Ingresso primeiro = ingressoRepository.save(new Ingresso(null, reserva1.getId(), a1.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, mesmoInstante));
        Ingresso segundo = ingressoRepository.save(new Ingresso(null, reserva1.getId(), a2.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, mesmoInstante));
        ingressoRepository.save(new Ingresso(null, reserva2.getId(), a3.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, mesmoInstante));

        Page<IngressoResumoProjection> paginaUm = ingressoRepository.buscarPorCliente(cliente1Id, PageRequest.of(0, 1));
        Page<IngressoResumoProjection> paginaDois = ingressoRepository.buscarPorCliente(cliente1Id, PageRequest.of(1, 1));

        // O total conta só o que é do cliente: o ingresso do cliente 2 está na mesma sessão e na
        // mesma sala, então um countQuery que perdesse o filtro de reserva devolveria 3.
        assertThat(paginaUm.getTotalElements()).isEqualTo(2);
        assertThat(paginaUm.getTotalPages()).isEqualTo(2);
        assertThat(paginaUm.getContent()).hasSize(1);
        assertThat(paginaDois.getContent()).hasSize(1);
        assertThat(List.of(
                        paginaUm.getContent().get(0).getId(),
                        paginaDois.getContent().get(0).getId()))
                .containsExactlyInAnyOrder(primeiro.getId(), segundo.getId());
    }

    private Assento novoAssento(Long salaId, int numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "salaId", salaId);
        ReflectionTestUtils.setField(assento, "fileira", "A");
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assentoRepository.save(assento);
    }

    /**
     * O mapa da sessão, que a fixture montava só na cabeça: aqui as sessões nascem por
     * {@code sessaoRepository.save()} e não por {@code SessaoService.criar()}, então nenhuma linha
     * de {@code assento_sessao} vinha junto. A FK composta da V8 tornou isso um estado impossível —
     * ingresso agora aponta pra uma linha real do mapa.
     */
    private void mapeiaNaSessao(Long sessaoId, Assento... assentos) {
        for (Assento assento : assentos) {
            assentoSessaoRepository.save(
                    new AssentoSessao(new AssentoSessaoId(sessaoId, assento.getId()), StatusAssento.VENDIDO, null, null));
        }
    }

    /**
     * A carteira é histórico de compra, não agenda: quem acabou de comprar abre a tela pra
     * conferir o que comprou, e o ingresso novo tem que estar na primeira linha mesmo que a sessão
     * dele seja anterior à de uma compra antiga. Ordenar pela data da sessão jogava a compra
     * recente pro meio da lista — e, em DESC, ainda abria a carteira pela sessão mais distante.
     */
    @Test
    void buscarPorClientePoeACompraMaisRecenteNoTopoAindaQueASessaoSejaMaisCedo() {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", "Sala ordem de compra (fixture)");
        ReflectionTestUtils.setField(sala, "linhas", 1);
        ReflectionTestUtils.setField(sala, "colunas", 2);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();

        Assento a1 = novoAssento(sala.getId(), 1);
        Assento a2 = novoAssento(sala.getId(), 2);

        // A sessão da compra recente é a mais CEDO das duas: é exatamente o caso que a ordenação
        // por data de sessão errava.
        Sessao sessaoCedo = novaSessao(sala.getId(), "Sessão cedo (fixture)", 30);
        sessaoCriadaId = sessaoCedo.getId();
        Sessao sessaoTarde = novaSessao(sala.getId(), "Sessão tarde (fixture)", 120);
        outraSessaoCriadaId = sessaoTarde.getId();
        mapeiaNaSessao(sessaoCedo.getId(), a1);
        mapeiaNaSessao(sessaoTarde.getId(), a2);

        Long cliente1Id = usuarioRepository.findByEmail(CLIENTE_1).orElseThrow().getId();
        Reserva reservaAntiga = reservaRepository.save(new Reserva(
                null, cliente1Id, sessaoTarde.getId(), StatusReserva.CONFIRMADA,
                Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva1Id = reservaAntiga.getId();
        Reserva reservaNova = reservaRepository.save(new Reserva(
                null, cliente1Id, sessaoCedo.getId(), StatusReserva.CONFIRMADA,
                Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva2Id = reservaNova.getId();

        Instant compraAntiga = Instant.now().truncatedTo(ChronoUnit.MICROS).minusSeconds(3600);
        Instant compraRecente = compraAntiga.plusSeconds(3600);
        Ingresso ingressoAntigo = ingressoRepository.save(new Ingresso(
                null, reservaAntiga.getId(), a2.getId(), sessaoTarde.getId(), codigoCurtoDeTeste(),
                StatusIngresso.VALIDO, null, compraAntiga));
        Ingresso ingressoRecente = ingressoRepository.save(new Ingresso(
                null, reservaNova.getId(), a1.getId(), sessaoCedo.getId(), codigoCurtoDeTeste(),
                StatusIngresso.VALIDO, null, compraRecente));

        List<IngressoResumoProjection> resultado =
                ingressoRepository.buscarPorCliente(cliente1Id, Pageable.unpaged()).getContent();

        assertThat(resultado).hasSize(2);
        assertThat(resultado.get(0).getId()).isEqualTo(ingressoRecente.getId());
        assertThat(resultado.get(1).getId()).isEqualTo(ingressoAntigo.getId());
    }

    private Sessao novaSessao(Long salaId, String titulo, int diasAFrente) {
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        return sessaoRepository.save(Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo(titulo)
                .dataHora(LocalDateTime.now().plusDays(diasAFrente).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build());
    }

    @Test
    void buscarPorClienteDesempataIngressosDaMesmaSessaoPorCreatedAt() {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", "Sala desempate (fixture)");
        ReflectionTestUtils.setField(sala, "linhas", 1);
        ReflectionTestUtils.setField(sala, "colunas", 2);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();

        Assento a1 = new Assento();
        ReflectionTestUtils.setField(a1, "salaId", sala.getId());
        ReflectionTestUtils.setField(a1, "fileira", "A");
        ReflectionTestUtils.setField(a1, "numero", 1);
        a1 = assentoRepository.save(a1);

        Assento a2 = new Assento();
        ReflectionTestUtils.setField(a2, "salaId", sala.getId());
        ReflectionTestUtils.setField(a2, "fileira", "A");
        ReflectionTestUtils.setField(a2, "numero", 2);
        a2 = assentoRepository.save(a2);

        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(sala.getId())
                .tmdbId(550L)
                .titulo("Sessão desempate (fixture)")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessao = sessaoRepository.save(sessao);
        sessaoCriadaId = sessao.getId();
        mapeiaNaSessao(sessao.getId(), a1, a2);

        Long cliente1Id = usuarioRepository.findByEmail(CLIENTE_1).orElseThrow().getId();
        Reserva reserva1 = reservaRepository.save(new Reserva(
                null, cliente1Id, sessao.getId(), StatusReserva.CONFIRMADA, Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        reserva1Id = reserva1.getId();

        // Dois ingressos da MESMA sessão (mesmo dataHora) — sem desempate, a ordem entre eles
        // não é garantida pelo banco. Insere o mais ANTIGO primeiro de propósito: se o teste só
        // passasse por coincidir com a ordem física de inserção, trocar a ordem de save() aqui
        // teria que quebrar o teste sem o ORDER BY explícito por createdAt.
        Instant primeiro = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant segundo = primeiro.plusSeconds(1);
        Ingresso ingressoMaisAntigo = ingressoRepository.save(new Ingresso(null, reserva1.getId(), a1.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, primeiro));
        Ingresso ingressoMaisNovo = ingressoRepository.save(new Ingresso(null, reserva1.getId(), a2.getId(), sessao.getId(), codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, segundo));

        List<IngressoResumoProjection> resultado =
                ingressoRepository.buscarPorCliente(cliente1Id, Pageable.unpaged()).getContent();

        assertThat(resultado).hasSize(2);
        assertThat(resultado.get(0).getId()).isEqualTo(ingressoMaisNovo.getId());
        assertThat(resultado.get(1).getId()).isEqualTo(ingressoMaisAntigo.getId());
    }
}
