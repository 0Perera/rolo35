package br.com.rolo35.api.sessoes.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.common.Paginacao;
import br.com.rolo35.api.common.PaginaDto;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
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
import br.com.rolo35.api.sessoes.StatusAssento;
import br.com.rolo35.api.sessoes.dto.AssentoMapaDto;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.MapaAssentosDto;
import br.com.rolo35.api.sessoes.dto.OcupacaoSalaDto;
import br.com.rolo35.api.sessoes.dto.SessaoGestaoDto;
import br.com.rolo35.api.sessoes.dto.SessaoListagemDto;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.repository.AssentoMapaProjection;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessaoService {

    private static final int BUFFER_MINUTOS = 240;

    private final SalaRepository salaRepository;
    private final AssentoRepository assentoRepository;
    private final SessaoRepository sessaoRepository;
    private final AssentoSessaoRepository assentoSessaoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EntityManager entityManager;

    public SessaoService(
            SalaRepository salaRepository, AssentoRepository assentoRepository, SessaoRepository sessaoRepository,
            AssentoSessaoRepository assentoSessaoRepository, UsuarioRepository usuarioRepository,
            EntityManager entityManager) {
        this.salaRepository = salaRepository;
        this.assentoRepository = assentoRepository;
        this.sessaoRepository = sessaoRepository;
        this.assentoSessaoRepository = assentoSessaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public SessaoResponse criar(CriarSessaoRequest request, String organizadorEmail) {
        // Tudo que depende só do request roda antes de qualquer lock: a transação que segura a
        // linha da sala precisa ser a mais curta possível (AD-5), então nenhuma validação
        // evitável acontece com o lock em mãos.
        if (!request.dataHora().isAfter(LocalDateTime.now())) {
            throw new DataHoraNoPassadoException();
        }
        LocalDate dataEstreia = parseDataEstreia(request.dataEstreia());

        Usuario organizador = usuarioRepository
                .findByEmail(organizadorEmail)
                .orElseThrow(OrganizadorNaoEncontradoException::new);

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Sala sala = salaRepository.findByIdForUpdate(request.salaId()).orElseThrow(SalaNaoEncontradaException::new);

        if (sessaoRepository.existeConflitante(sala.getId(), request.dataHora(), BUFFER_MINUTOS)) {
            throw new SessaoConflitanteException();
        }

        // AC1: a capacidade sai do mapa de assentos de fato cadastrado, não do retângulo
        // linhas x colunas declarado na sala — as duas fontes podem divergir e é o mapa que
        // determina quantos ingressos existem pra vender.
        List<Assento> assentos = assentoRepository.findBySalaId(sala.getId());
        if (assentos.isEmpty()) {
            throw new SalaSemAssentosException();
        }
        int capacidade = assentos.size();

        Sessao sessao = Sessao.builder()
                .organizadorId(organizador.getId())
                .salaId(sala.getId())
                .tmdbId(request.tmdbId())
                .titulo(request.titulo())
                .posterUrl(request.posterUrl())
                .sinopse(request.sinopse())
                .dataEstreia(dataEstreia)
                .dataHora(request.dataHora())
                .preco(request.preco())
                .createdAt(Instant.now())
                .build();
        Sessao sessaoSalva = sessaoRepository.save(sessao);

        List<AssentoSessao> assentoSessoes = assentos.stream()
                .map(assento -> new AssentoSessao(
                        new AssentoSessaoId(sessaoSalva.getId(), assento.getId()), StatusAssento.LIVRE, null, null))
                .toList();
        assentoSessaoRepository.saveAll(assentoSessoes);

        return new SessaoResponse(
                sessaoSalva.getId(), sala.getId(), sala.getNome(), sessaoSalva.getTmdbId(), sessaoSalva.getTitulo(),
                sessaoSalva.getPosterUrl(), sessaoSalva.getSinopse(), request.dataEstreia(),
                sessaoSalva.getDataHora(), sessaoSalva.getPreco(), capacidade, organizador.getId());
    }

    @Transactional
    public SessaoResponse editar(Long id, EditarSessaoRequest request, String organizadorEmail) {
        // A conta ainda precisa existir — um JWT válido de usuário já removido não edita nada. O
        // que não existe mais é comparar essa conta com a que criou a sessão (CAP-1).
        usuarioRepository.findByEmail(organizadorEmail).orElseThrow(OrganizadorNaoEncontradoException::new);

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Sessao sessao = sessaoRepository.findByIdForUpdate(id).orElseThrow(SessaoNaoEncontradaException::new);

        if (!request.dataHora().isAfter(LocalDateTime.now())) {
            throw new DataHoraNoPassadoException();
        }
        if (sessaoRepository.existeIngressoConfirmado(id)) {
            throw new SessaoComIngressoConfirmadoException();
        }

        boolean trocouSala = !sessao.getSalaId().equals(request.salaId());
        Sala sala = salaRepository.findByIdForUpdate(request.salaId()).orElseThrow(SalaNaoEncontradaException::new);

        if (sessaoRepository.existeConflitanteExcluindo(sala.getId(), request.dataHora(), BUFFER_MINUTOS, id)) {
            throw new SessaoConflitanteException();
        }

        int capacidade;
        if (trocouSala) {
            // Passo anterior já garantiu que não há ingresso confirmado — nenhum estado de venda
            // se perde ao trocar o mapa de assentos pra sala nova. Mas um hold ativo (cliente em
            // checkout, Story 3.2) é diferente: apagar assento_sessao sob ele deixaria a reserva
            // órfã, apontando pra uma linha que não existe mais (dívida obrigatória da Story 2.2).
            // travarPorSessao() (não findByIdSessaoId) trava as linhas via PESSIMISTIC_WRITE antes
            // de ler o status: sem o lock, um reservar() concorrente podia confirmar um hold novo
            // entre esta leitura e o deleteAll logo abaixo, reabrindo a mesma corrida (achado do
            // code review da Story 3.2 — ver ReservaEditarConcorrenciaTest pra prova via banco real).
            List<AssentoSessao> linhasAtuais = assentoSessaoRepository.travarPorSessao(id);
            LocalDateTime agora = LocalDateTime.now();
            boolean temHoldAtivo = linhasAtuais.stream().anyMatch(assento -> holdAtivo(assento, agora));
            if (temHoldAtivo) {
                throw new HoldAtivoException();
            }
            assentoSessaoRepository.deleteAll(linhasAtuais);
            List<Assento> assentos = assentoRepository.findBySalaId(sala.getId());
            if (assentos.isEmpty()) {
                throw new SalaSemAssentosException();
            }
            List<AssentoSessao> assentoSessoes = assentos.stream()
                    .map(assento -> new AssentoSessao(new AssentoSessaoId(id, assento.getId()), StatusAssento.LIVRE, null, null))
                    .toList();
            assentoSessaoRepository.saveAll(assentoSessoes);
            capacidade = assentos.size();
        } else {
            capacidade = assentoSessaoRepository.findByIdSessaoId(id).size();
        }

        Sessao sessaoEditada = sessao.toBuilder()
                .salaId(sala.getId())
                .titulo(request.titulo())
                .sinopse(request.sinopse())
                .dataHora(request.dataHora())
                .preco(request.preco())
                .build();
        Sessao sessaoSalva = sessaoRepository.save(sessaoEditada);

        return new SessaoResponse(
                sessaoSalva.getId(), sala.getId(), sala.getNome(), sessaoSalva.getTmdbId(), sessaoSalva.getTitulo(),
                sessaoSalva.getPosterUrl(), sessaoSalva.getSinopse(),
                sessaoSalva.getDataEstreia() == null ? null : sessaoSalva.getDataEstreia().toString(),
                sessaoSalva.getDataHora(), sessaoSalva.getPreco(), capacidade, sessaoSalva.getOrganizadorId());
    }

    /**
     * Gestão lista o cinema inteiro, não a agenda pessoal de quem chamou (CAP-1). O e-mail continua
     * na assinatura só pra exigir uma conta viva por trás do token.
     *
     * <p>Paginada pelo mesmo {@link Paginacao} da vitrine: o teto de tamanho é regra de servidor e
     * vale igual pros dois lados, senão a listagem de gestão vira a única rota sem limite.
     */
    public PaginaDto<SessaoGestaoDto> listarParaGestao(String organizadorEmail, int pagina, int tamanho) {
        usuarioRepository.findByEmail(organizadorEmail).orElseThrow(OrganizadorNaoEncontradoException::new);
        return PaginaDto.de(
                sessaoRepository.findParaGestao(Paginacao.de(pagina, tamanho)),
                projecao -> new SessaoGestaoDto(
                        projecao.getId(), projecao.getSalaId(), projecao.getSalaNome(), projecao.getTitulo(),
                        projecao.getSinopse(), projecao.getDataHora(), projecao.getPreco(), projecao.getCapacidade(),
                        projecao.getEditavel()));
    }

    /**
     * Ocupação da sala pro formulário mostrar o conflito antes do submit, em vez de deixar o
     * organizador descobrir por {@code 409}. O buffer é aplicado aqui: a regra de conflito é do
     * back-end, e duplicá-la no front garantiria que as duas cópias divergissem.
     */
    public List<OcupacaoSalaDto> listarOcupacaoDaSala(Long salaId) {
        salaRepository.findById(salaId).orElseThrow(SalaNaoEncontradaException::new);
        return sessaoRepository.listarOcupacaoDaSala(salaId, BUFFER_MINUTOS).stream()
                .map(projecao -> new OcupacaoSalaDto(
                        projecao.getId(),
                        projecao.getDataHora(),
                        projecao.getDataHora().minusMinutes(BUFFER_MINUTOS),
                        projecao.getDataHora().plusMinutes(BUFFER_MINUTOS)))
                .toList();
    }

    public SessaoGestaoDto buscarPorId(Long id, String organizadorEmail) {
        usuarioRepository.findByEmail(organizadorEmail).orElseThrow(OrganizadorNaoEncontradoException::new);
        Sessao sessao = sessaoRepository.findById(id).orElseThrow(SessaoNaoEncontradaException::new);
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        int capacidade = assentoSessaoRepository.findByIdSessaoId(id).size();
        boolean editavel = !sessaoRepository.existeIngressoConfirmado(id);
        return new SessaoGestaoDto(
                sessao.getId(), sala.getId(), sala.getNome(), sessao.getTitulo(), sessao.getSinopse(),
                sessao.getDataHora(), sessao.getPreco(), capacidade, editavel);
    }

    public PaginaDto<SessaoListagemDto> listarPublicadas(
            String busca, Long tmdbId, Long salaId, int pagina, int tamanho) {
        Pageable paginacao = Paginacao.de(pagina, tamanho);
        return PaginaDto.de(
                sessaoRepository.listarPublicadas(
                        padraoDeBusca(busca), tmdbId == null ? 0L : tmdbId, salaId == null ? 0L : salaId, paginacao),
                projecao -> new SessaoListagemDto(
                        projecao.getId(), projecao.getSalaNome(), projecao.getTmdbId(), projecao.getTitulo(),
                        projecao.getPosterUrl(), projecao.getSinopse(), projecao.getDataEstreia(),
                        projecao.getDataHora(), projecao.getPreco(), projecao.getCapacidade(),
                        projecao.getAssentosLivres() == 0));
    }

    /**
     * Transforma o texto digitado num padrão LIKE. Os curingas do próprio LIKE precisam ser
     * neutralizados antes: sem isso, quem digita {@code _} casa com qualquer caractere e quem
     * digita {@code %} casa com a base inteira — o campo de busca deixa de buscar.
     */
    private static String padraoDeBusca(String busca) {
        if (busca == null || busca.isBlank()) {
            return "%";
        }
        String escapado = busca.trim()
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
        return "%" + escapado + "%";
    }

    private LocalDate parseDataEstreia(String dataEstreia) {
        if (dataEstreia == null || dataEstreia.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(dataEstreia);
        } catch (DateTimeParseException e) {
            throw new DataEstreiaInvalidaException();
        }
    }

    public MapaAssentosDto mapaAssentos(Long sessaoId) {
        Sessao sessao = sessaoRepository.findById(sessaoId).orElseThrow(SessaoNaoEncontradaException::new);
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        LocalDateTime agora = LocalDateTime.now();
        List<AssentoMapaDto> assentos = assentoSessaoRepository.buscarMapaPorSessao(sessaoId).stream()
                .map(p -> new AssentoMapaDto(p.getAssentoId(), p.getFileira(), p.getNumero(), statusEfetivo(p, agora)))
                .toList();
        return new MapaAssentosDto(
                sessao.getId(), sessao.getTmdbId(), sessao.getTitulo(), sessao.getPosterUrl(), sala.getNome(),
                sessao.getDataHora(), sessao.getPreco(), assentos);
    }

    private String statusEfetivo(AssentoMapaProjection projecao, LocalDateTime agora) {
        // A projeção vem de query nativa, então aqui o status ainda é o texto cru da coluna — o
        // enum entra na borda, comparando pelo name().
        boolean holdVencido = StatusAssento.RESERVADO.name().equals(projecao.getStatus())
                && projecao.getExpiresAt() != null
                && projecao.getExpiresAt().isBefore(agora);
        return holdVencido ? StatusAssento.LIVRE.name() : projecao.getStatus();
    }

    // Mesma regra de TTL lazy (AD-4) de statusEfetivo, aplicada a AssentoSessao em vez da
    // projeção de leitura: hold vencido não é hold ativo, uma nova reserva pode reivindicar.
    private boolean holdAtivo(AssentoSessao assento, LocalDateTime agora) {
        return assento.getStatus() == StatusAssento.RESERVADO
                && assento.getExpiresAt() != null
                && !assento.getExpiresAt().isBefore(agora);
    }
}
