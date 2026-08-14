package br.com.rolo35.api.sessoes.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.DataEstreiaInvalidaException;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.HoldAtivoException;
import br.com.rolo35.api.sessoes.OrganizadorNaoEncontradoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.SalaSemAssentosException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoComIngressoConfirmadoException;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.SessaoNaoPertenceAoOrganizadorException;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.repository.AssentoMapaProjection;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoListagemProjection;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SessaoServiceTest {

    @Mock
    private SalaRepository salaRepository;

    @Mock
    private AssentoRepository assentoRepository;

    @Mock
    private SessaoRepository sessaoRepository;

    @Mock
    private AssentoSessaoRepository assentoSessaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query query;

    private SessaoService sessaoService;

    @BeforeEach
    void setUp() {
        sessaoService = new SessaoService(
                salaRepository, assentoRepository, sessaoRepository, assentoSessaoRepository, usuarioRepository,
                entityManager);
    }

    private Sala salaCom(Long id, String nome, int linhas, int colunas) {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "id", id);
        ReflectionTestUtils.setField(sala, "nome", nome);
        ReflectionTestUtils.setField(sala, "linhas", linhas);
        ReflectionTestUtils.setField(sala, "colunas", colunas);
        return sala;
    }

    private Usuario organizadorCom(Long id, String email) {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", id);
        ReflectionTestUtils.setField(usuario, "email", email);
        ReflectionTestUtils.setField(usuario, "papel", "ORGANIZADOR");
        return usuario;
    }

    private Assento assentoCom(Long id, Long salaId, String fileira, int numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "id", id);
        ReflectionTestUtils.setField(assento, "salaId", salaId);
        ReflectionTestUtils.setField(assento, "fileira", fileira);
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assento;
    }

    private List<Assento> mapaDeAssentos(int linhas, int colunas) {
        return IntStream.range(0, linhas * colunas)
                .mapToObj(i -> assentoCom(
                        (long) i + 1, 1L, String.valueOf((char) ('A' + i / colunas)), i % colunas + 1))
                .toList();
    }

    private CriarSessaoRequest requestValido() {
        return new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"));
    }

    private void stubOrganizador() {
        given(usuarioRepository.findByEmail("organizador@rolo35.com.br"))
                .willReturn(Optional.of(organizadorCom(10L, "organizador@rolo35.com.br")));
    }

    @Test
    void criaSessaoComCapacidadeDerivadaDoMapaDeAssentosQuandoNaoHaConflito() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        stubOrganizador();
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> {
            Sessao sessao = invocation.getArgument(0);
            ReflectionTestUtils.setField(sessao, "id", 100L);
            return sessao;
        });
        given(assentoRepository.findBySalaId(1L)).willReturn(mapaDeAssentos(5, 8));

        var resposta = sessaoService.criar(requestValido(), "organizador@rolo35.com.br");

        assertThat(resposta.capacidade()).isEqualTo(40);
        assertThat(resposta.salaNome()).isEqualTo("Sala 1");
        assertThat(resposta.organizadorId()).isEqualTo(10L);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<br.com.rolo35.api.sessoes.AssentoSessao>> captor = ArgumentCaptor.forClass(List.class);
        verify(assentoSessaoRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(40);
        assertThat(captor.getValue()).allSatisfy(as -> assertThat(as.getStatus()).isEqualTo("LIVRE"));
    }

    // A capacidade anunciada tem que sair do mapa de assentos de fato cadastrado (AC1), não do
    // retângulo linhas x colunas declarado na sala — se as duas fontes divergirem, é o mapa que
    // determina quantos ingressos existem pra vender.
    @Test
    void capacidadeVemDoMapaDeAssentosENaoDeLinhasVezesColunas() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        stubOrganizador();
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> {
            Sessao sessao = invocation.getArgument(0);
            ReflectionTestUtils.setField(sessao, "id", 100L);
            return sessao;
        });
        given(assentoRepository.findBySalaId(1L)).willReturn(mapaDeAssentos(1, 8));

        var resposta = sessaoService.criar(requestValido(), "organizador@rolo35.com.br");

        assertThat(resposta.capacidade()).isEqualTo(8);
    }

    @Test
    void rejeitaSalaSemMapaDeAssentos() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        stubOrganizador();
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(false);
        given(assentoRepository.findBySalaId(1L)).willReturn(List.of());

        assertThatThrownBy(() -> sessaoService.criar(requestValido(), "organizador@rolo35.com.br"))
                .isInstanceOf(SalaSemAssentosException.class);

        verify(sessaoRepository, never()).save(any());
    }

    @Test
    void rejeitaDataHoraNoPassadoSemTravarSala() {
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().minusDays(1),
                new BigDecimal("25.00"));

        assertThatThrownBy(() -> sessaoService.criar(request, "organizador@rolo35.com.br"))
                .isInstanceOf(DataHoraNoPassadoException.class);

        verify(salaRepository, never()).findByIdForUpdate(any());
    }

    // Guarda de regressão do fuso: a comparação de "está no futuro?" é wall-clock contra
    // wall-clock. O front manda a hora local do organizador sem zona, então trocar o
    // LocalDateTime.now() por qualquer referência em UTC volta a rejeitar as próximas horas.
    @Test
    void aceitaDataHoraPoucasHorasAFrenteDoRelogioLocal() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        stubOrganizador();
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> {
            Sessao sessao = invocation.getArgument(0);
            ReflectionTestUtils.setField(sessao, "id", 100L);
            return sessao;
        });
        given(assentoRepository.findBySalaId(1L)).willReturn(mapaDeAssentos(5, 8));
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusHours(2),
                new BigDecimal("25.00"));

        var resposta = sessaoService.criar(request, "organizador@rolo35.com.br");

        assertThat(resposta.id()).isEqualTo(100L);
    }

    @Test
    void rejeitaDataEstreiaMalformadaSemTravarSala() {
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, "15/10/1999", LocalDateTime.now().plusDays(30),
                new BigDecimal("25.00"));

        assertThatThrownBy(() -> sessaoService.criar(request, "organizador@rolo35.com.br"))
                .isInstanceOf(DataEstreiaInvalidaException.class);

        verify(salaRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void rejeitaSessaoConflitanteAposTravarSala() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        stubOrganizador();
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(true);

        assertThatThrownBy(() -> sessaoService.criar(requestValido(), "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoConflitanteException.class);

        verify(salaRepository).findByIdForUpdate(1L);
        verify(sessaoRepository, never()).save(any());
    }

    @Test
    void rejeitaSalaInexistente() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.empty());
        stubOrganizador();

        assertThatThrownBy(() -> sessaoService.criar(requestValido(), "organizador@rolo35.com.br"))
                .isInstanceOf(SalaNaoEncontradaException.class);
    }

    // Token assinado e não expirado cujo usuário sumiu do banco não pode virar 500.
    @Test
    void rejeitaOrganizadorInexistenteSemTravarSala() {
        given(usuarioRepository.findByEmail("fantasma@rolo35.com.br")).willReturn(Optional.empty());

        assertThatThrownBy(() -> sessaoService.criar(requestValido(), "fantasma@rolo35.com.br"))
                .isInstanceOf(OrganizadorNaoEncontradoException.class);

        verify(salaRepository, never()).findByIdForUpdate(any());
    }

    private SessaoListagemProjection projecaoCom(Long id, long assentosLivres) {
        SessaoListagemProjection projecao = mock(SessaoListagemProjection.class);
        given(projecao.getId()).willReturn(id);
        given(projecao.getSalaNome()).willReturn("Sala 1");
        given(projecao.getTmdbId()).willReturn(550L);
        given(projecao.getTitulo()).willReturn("Clube da Luta");
        given(projecao.getPosterUrl()).willReturn("http://poster");
        given(projecao.getSinopse()).willReturn("sinopse");
        given(projecao.getDataEstreia()).willReturn(LocalDate.parse("1999-10-15"));
        given(projecao.getDataHora()).willReturn(LocalDateTime.now().plusDays(7));
        given(projecao.getPreco()).willReturn(new BigDecimal("25.00"));
        given(projecao.getCapacidade()).willReturn(40);
        given(projecao.getAssentosLivres()).willReturn(assentosLivres);
        return projecao;
    }

    private void stubListagem(SessaoListagemProjection... projecoes) {
        given(sessaoRepository.listarPublicadas(anyString(), anyLong(), anyLong(), any(Pageable.class)))
                .willReturn(new PageImpl<>(List.of(projecoes)));
    }

    @Test
    void listarPublicadasMarcaEsgotadaFalseQuandoHaAssentoLivre() {
        stubListagem(projecaoCom(1L, 12L));

        var pagina = sessaoService.listarPublicadas(null, null, null, 0, 12);

        assertThat(pagina.conteudo()).hasSize(1);
        assertThat(pagina.conteudo().get(0).esgotada()).isFalse();
    }

    @Test
    void listarPublicadasMarcaEsgotadaTrueQuandoZeroAssentosLivres() {
        stubListagem(projecaoCom(2L, 0L));

        var pagina = sessaoService.listarPublicadas(null, null, null, 0, 12);

        assertThat(pagina.conteudo()).hasSize(1);
        assertThat(pagina.conteudo().get(0).esgotada()).isTrue();
    }

    @Test
    void listarPublicadasRetornaPaginaVaziaSemLancarExcecaoQuandoRepositoryNaoTemNada() {
        stubListagem();

        var pagina = sessaoService.listarPublicadas(null, null, null, 0, 12);

        assertThat(pagina.conteudo()).isEmpty();
        assertThat(pagina.total()).isZero();
    }

    // Busca em branco não pode virar filtro: sem o '%' o LIKE casaria só com título vazio e a
    // listagem sumiria inteira assim que o operador apagasse o que digitou.
    @Test
    void buscaVaziaViraPadraoQueCasaComTudo() {
        stubListagem(projecaoCom(1L, 5L));

        sessaoService.listarPublicadas("   ", null, null, 0, 12);

        then(sessaoRepository).should().listarPublicadas(eq("%"), eq(0L), eq(0L), any(Pageable.class));
    }

    // Quem digita '%' ou '_' está buscando esses caracteres, não pedindo curinga. Sem escapar,
    // um '_' solto casa com a base inteira e o campo de busca deixa de filtrar.
    @Test
    void escapaCuringasDoLikeVindosDaBusca() {
        stubListagem();

        sessaoService.listarPublicadas("100%_de_ação", null, null, 0, 12);

        then(sessaoRepository).should().listarPublicadas(eq("%100!%!_de!_ação%"), eq(0L), eq(0L), any(Pageable.class));
    }

    // Sem teto, "paginação" com tamanho absurdo é só a listagem completa com outro nome.
    @Test
    void limitaOTamanhoDePaginaPedidoPeloCliente() {
        stubListagem();

        sessaoService.listarPublicadas(null, null, null, 0, 1_000_000);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        then(sessaoRepository).should().listarPublicadas(anyString(), anyLong(), anyLong(), captor.capture());
        assertThat(captor.getValue().getPageSize()).isEqualTo(SessaoService.TAMANHO_PAGINA_MAXIMO);
    }

    @Test
    void trocaTamanhoInvalidoPeloPadraoEmVezDeFalhar() {
        stubListagem();

        sessaoService.listarPublicadas(null, null, null, -3, 0);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        then(sessaoRepository).should().listarPublicadas(anyString(), anyLong(), anyLong(), captor.capture());
        assertThat(captor.getValue().getPageSize()).isEqualTo(SessaoService.TAMANHO_PAGINA_PADRAO);
        assertThat(captor.getValue().getPageNumber()).isZero();
    }

    private Sessao sessaoCom(Long id, Long organizadorId, Long salaId, String titulo, LocalDateTime dataHora) {
        return Sessao.builder()
                .id(id)
                .organizadorId(organizadorId)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo(titulo)
                .sinopse("sinopse")
                .dataHora(dataHora)
                .preco(new BigDecimal("25.00"))
                .createdAt(java.time.Instant.now())
                .build();
    }

    private EditarSessaoRequest editarRequestValido(Long salaId) {
        return new EditarSessaoRequest(
                salaId, "Clube da Luta (editado)", "sinopse editada", LocalDateTime.now().plusDays(30),
                new BigDecimal("30.00"));
    }

    @Test
    void editaSessaoComSucessoSemTrocarSala() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        given(sessaoRepository.existeIngressoConfirmado(5L)).willReturn(false);
        given(sessaoRepository.existeConflitanteExcluindo(anyLong(), any(LocalDateTime.class), any(Integer.class), anyLong()))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> invocation.getArgument(0));
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));

        var resposta = sessaoService.editar(5L, editarRequestValido(1L), "organizador@rolo35.com.br");

        assertThat(resposta.titulo()).isEqualTo("Clube da Luta (editado)");
        assertThat(resposta.preco()).isEqualByComparingTo("30.00");
        verify(assentoSessaoRepository, never()).saveAll(any());
        verify(assentoSessaoRepository, never()).deleteAll(anyList());
    }

    @Test
    void editaSessaoTrocandoSalaReescreveAssentoSessao() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        given(sessaoRepository.existeIngressoConfirmado(5L)).willReturn(false);
        given(salaRepository.findByIdForUpdate(2L)).willReturn(Optional.of(salaCom(2L, "Sala 2", 3, 4)));
        given(sessaoRepository.existeConflitanteExcluindo(eq(2L), any(LocalDateTime.class), any(Integer.class), eq(5L)))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> invocation.getArgument(0));
        given(assentoRepository.findBySalaId(2L)).willReturn(mapaDeAssentos(3, 4));
        AssentoSessao linhaAntiga = new AssentoSessao(new AssentoSessaoId(5L, 1L), "LIVRE", null, null);
        given(assentoSessaoRepository.travarPorSessao(5L)).willReturn(List.of(linhaAntiga));

        var resposta = sessaoService.editar(5L, editarRequestValido(2L), "organizador@rolo35.com.br");

        assertThat(resposta.capacidade()).isEqualTo(12);
        verify(assentoSessaoRepository).deleteAll(List.of(linhaAntiga));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AssentoSessao>> captor = ArgumentCaptor.forClass(List.class);
        verify(assentoSessaoRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(12);
        assertThat(captor.getValue()).allSatisfy(as -> assertThat(as.getStatus()).isEqualTo("LIVRE"));
    }

    // Dívida obrigatória do review da Story 2.2 (deferred-work.md): trocar de sala com um hold
    // ativo em andamento apagaria assento_sessao sob o cliente em checkout, deixando a reserva
    // órfã. Só alcançável agora que ReservaService.reservar() cria holds de verdade (Story 3.2).
    @Test
    void rejeitaTrocaDeSalaComHoldAtivoAntesDeApagarAssentoSessao() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        given(sessaoRepository.existeIngressoConfirmado(5L)).willReturn(false);
        given(salaRepository.findByIdForUpdate(2L)).willReturn(Optional.of(salaCom(2L, "Sala 2", 3, 4)));
        given(sessaoRepository.existeConflitanteExcluindo(eq(2L), any(LocalDateTime.class), any(Integer.class), eq(5L)))
                .willReturn(false);
        AssentoSessao holdAtivo =
                new AssentoSessao(new AssentoSessaoId(5L, 1L), "RESERVADO", 42L, LocalDateTime.now().plusMinutes(5));
        given(assentoSessaoRepository.travarPorSessao(5L)).willReturn(List.of(holdAtivo));

        assertThatThrownBy(() -> sessaoService.editar(5L, editarRequestValido(2L), "organizador@rolo35.com.br"))
                .isInstanceOf(HoldAtivoException.class);

        verify(assentoSessaoRepository, never()).deleteAll(anyList());
        verify(assentoSessaoRepository, never()).saveAll(any());
        verify(sessaoRepository, never()).save(any());
    }

    // Cenário de controle: hold vencido (TTL lazy, AD-4) não é hold ativo — não bloqueia a edição.
    @Test
    void holdVencidoNaoBloqueiaTrocaDeSala() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        given(sessaoRepository.existeIngressoConfirmado(5L)).willReturn(false);
        given(salaRepository.findByIdForUpdate(2L)).willReturn(Optional.of(salaCom(2L, "Sala 2", 3, 4)));
        given(sessaoRepository.existeConflitanteExcluindo(eq(2L), any(LocalDateTime.class), any(Integer.class), eq(5L)))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> invocation.getArgument(0));
        given(assentoRepository.findBySalaId(2L)).willReturn(mapaDeAssentos(3, 4));
        AssentoSessao holdVencido =
                new AssentoSessao(new AssentoSessaoId(5L, 1L), "RESERVADO", 42L, LocalDateTime.now().minusMinutes(1));
        given(assentoSessaoRepository.travarPorSessao(5L)).willReturn(List.of(holdVencido));

        var resposta = sessaoService.editar(5L, editarRequestValido(2L), "organizador@rolo35.com.br");

        assertThat(resposta.capacidade()).isEqualTo(12);
        verify(assentoSessaoRepository).deleteAll(List.of(holdVencido));
    }

    @Test
    void rejeitaEdicaoDeSessaoInexistente() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        given(sessaoRepository.findByIdForUpdate(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> sessaoService.editar(999L, editarRequestValido(1L), "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoNaoEncontradaException.class);
    }

    @Test
    void rejeitaEdicaoDeSessaoDeOutroOrganizadorSemChecarTravaOuConflito() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao deOutroOrganizador = sessaoCom(5L, 99L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(deOutroOrganizador));

        assertThatThrownBy(() -> sessaoService.editar(5L, editarRequestValido(1L), "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoNaoPertenceAoOrganizadorException.class);

        verify(sessaoRepository, never()).existeIngressoConfirmado(any());
        verify(sessaoRepository, never()).save(any());
    }

    @Test
    void rejeitaEdicaoDeSessaoComIngressoConfirmadoSemSalvar() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        given(sessaoRepository.existeIngressoConfirmado(5L)).willReturn(true);

        assertThatThrownBy(() -> sessaoService.editar(5L, editarRequestValido(1L), "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoComIngressoConfirmadoException.class);

        verify(sessaoRepository, never()).save(any());
    }

    @Test
    void rejeitaEdicaoComConflitoDeHorarioExcluindoAPropriaSessao() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        given(sessaoRepository.existeIngressoConfirmado(5L)).willReturn(false);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        given(sessaoRepository.existeConflitanteExcluindo(eq(1L), any(LocalDateTime.class), any(Integer.class), eq(5L)))
                .willReturn(true);

        assertThatThrownBy(() -> sessaoService.editar(5L, editarRequestValido(1L), "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoConflitanteException.class);

        verify(sessaoRepository, never()).save(any());
    }

    // Ownership precisa ser checado antes de validar o corpo (AC2: tentativa de editar sessão de
    // outro organizador é sempre 403, mesmo com corpo inválido) — então a sessão já foi carregada
    // (e o dono conferido) quando o erro de data no passado é lançado; só o lock da *sala* segue
    // evitado, porque nada até aqui depende dela.
    @Test
    void rejeitaEdicaoComDataHoraNoPassadoAposConfirmarQueSessaoEDoOrganizador() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao existente = sessaoCom(5L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(existente));
        EditarSessaoRequest request = new EditarSessaoRequest(
                1L, "Clube da Luta", "sinopse", LocalDateTime.now().minusDays(1), new BigDecimal("30.00"));

        assertThatThrownBy(() -> sessaoService.editar(5L, request, "organizador@rolo35.com.br"))
                .isInstanceOf(DataHoraNoPassadoException.class);

        verify(salaRepository, never()).findByIdForUpdate(any());
    }

    // AC2: tentativa de editar sessão de outro organizador é rejeitada com 403 — "mesmo sabendo o
    // ID" e independentemente do resto do corpo estar malformado. Prova o fix: sem essa ordem, um
    // corpo com dataHora no passado mirando sessão alheia devolveria 400 em vez de 403.
    @Test
    void rejeitaEdicaoDeSessaoDeOutroOrganizadorMesmoComDataHoraNoPassado() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        stubOrganizador();
        Sessao deOutroOrganizador = sessaoCom(5L, 99L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(10));
        given(sessaoRepository.findByIdForUpdate(5L)).willReturn(Optional.of(deOutroOrganizador));
        EditarSessaoRequest request = new EditarSessaoRequest(
                1L, "Clube da Luta", "sinopse", LocalDateTime.now().minusDays(1), new BigDecimal("30.00"));

        assertThatThrownBy(() -> sessaoService.editar(5L, request, "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoNaoPertenceAoOrganizadorException.class);
    }

    @Test
    void rejeitaEdicaoDeOrganizadorInexistenteSemTravarSessao() {
        given(usuarioRepository.findByEmail("fantasma@rolo35.com.br")).willReturn(Optional.empty());

        assertThatThrownBy(() -> sessaoService.editar(5L, editarRequestValido(1L), "fantasma@rolo35.com.br"))
                .isInstanceOf(OrganizadorNaoEncontradoException.class);

        verify(sessaoRepository, never()).findByIdForUpdate(any());
    }

    private AssentoMapaProjection projecaoMapaCom(
            Long assentoId, String fileira, Integer numero, String status, LocalDateTime expiresAt) {
        AssentoMapaProjection projecao = mock(AssentoMapaProjection.class);
        given(projecao.getAssentoId()).willReturn(assentoId);
        given(projecao.getFileira()).willReturn(fileira);
        given(projecao.getNumero()).willReturn(numero);
        given(projecao.getStatus()).willReturn(status);
        lenient().when(projecao.getExpiresAt()).thenReturn(expiresAt);
        return projecao;
    }

    @Test
    void mapaAssentosRetornaDtoPopuladoComContextoDaSessaoEAssentosOrdenados() {
        Sessao sessao = sessaoCom(7L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(30));
        given(sessaoRepository.findById(7L)).willReturn(Optional.of(sessao));
        given(salaRepository.findById(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        var projecoes = List.of(projecaoMapaCom(1L, "A", 1, "LIVRE", null));
        given(assentoSessaoRepository.buscarMapaPorSessao(7L)).willReturn(projecoes);

        var mapa = sessaoService.mapaAssentos(7L);

        assertThat(mapa.sessaoId()).isEqualTo(7L);
        // O tmdbId é o que permite voltar do mapa pra tela de escolha de sessão do filme: sem ele,
        // o único caminho de volta é a vitrine inteira.
        assertThat(mapa.tmdbId()).isEqualTo(550L);
        assertThat(mapa.titulo()).isEqualTo("Clube da Luta");
        assertThat(mapa.salaNome()).isEqualTo("Sala 1");
        assertThat(mapa.preco()).isEqualByComparingTo("25.00");
        assertThat(mapa.assentos()).hasSize(1);
        assertThat(mapa.assentos().get(0).id()).isEqualTo(1L);
        assertThat(mapa.assentos().get(0).fileira()).isEqualTo("A");
        assertThat(mapa.assentos().get(0).numero()).isEqualTo(1);
        assertThat(mapa.assentos().get(0).status()).isEqualTo("LIVRE");
    }

    @Test
    void mapaAssentosMantemReservadoQuandoExpiresAtNoFuturo() {
        Sessao sessao = sessaoCom(7L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(30));
        given(sessaoRepository.findById(7L)).willReturn(Optional.of(sessao));
        given(salaRepository.findById(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        var projecoes = List.of(projecaoMapaCom(1L, "A", 1, "RESERVADO", LocalDateTime.now().plusMinutes(5)));
        given(assentoSessaoRepository.buscarMapaPorSessao(7L)).willReturn(projecoes);

        var mapa = sessaoService.mapaAssentos(7L);

        assertThat(mapa.assentos().get(0).status()).isEqualTo("RESERVADO");
    }

    @Test
    void mapaAssentosViraLivreQuandoHoldExpiradoSemEscreverNoBanco() {
        Sessao sessao = sessaoCom(7L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(30));
        given(sessaoRepository.findById(7L)).willReturn(Optional.of(sessao));
        given(salaRepository.findById(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        var projecoes = List.of(projecaoMapaCom(1L, "A", 1, "RESERVADO", LocalDateTime.now().minusMinutes(5)));
        given(assentoSessaoRepository.buscarMapaPorSessao(7L)).willReturn(projecoes);

        var mapa = sessaoService.mapaAssentos(7L);

        assertThat(mapa.assentos().get(0).status()).isEqualTo("LIVRE");
        verify(assentoSessaoRepository, never()).save(any());
        verify(assentoSessaoRepository, never()).saveAll(any());
    }

    @Test
    void mapaAssentosMantemVendido() {
        Sessao sessao = sessaoCom(7L, 10L, 1L, "Clube da Luta", LocalDateTime.now().plusDays(30));
        given(sessaoRepository.findById(7L)).willReturn(Optional.of(sessao));
        given(salaRepository.findById(1L)).willReturn(Optional.of(salaCom(1L, "Sala 1", 5, 8)));
        var projecoes = List.of(projecaoMapaCom(1L, "A", 1, "VENDIDO", null));
        given(assentoSessaoRepository.buscarMapaPorSessao(7L)).willReturn(projecoes);

        var mapa = sessaoService.mapaAssentos(7L);

        assertThat(mapa.assentos().get(0).status()).isEqualTo("VENDIDO");
    }

    @Test
    void rejeitaMapaAssentosDeSessaoInexistente() {
        given(sessaoRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> sessaoService.mapaAssentos(999L)).isInstanceOf(SessaoNaoEncontradaException.class);
    }
}
