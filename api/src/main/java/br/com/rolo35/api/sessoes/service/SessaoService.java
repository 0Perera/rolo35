package br.com.rolo35.api.sessoes.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.DataEstreiaInvalidaException;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.OrganizadorNaoEncontradoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.SalaSemAssentosException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoComIngressoConfirmadoException;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.SessaoNaoPertenceAoOrganizadorException;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoGestaoDto;
import br.com.rolo35.api.sessoes.dto.SessaoListagemDto;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessaoService {

    private static final int BUFFER_MINUTOS = 240;
    private static final String STATUS_LIVRE = "LIVRE";

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
                        new AssentoSessaoId(sessaoSalva.getId(), assento.getId()), STATUS_LIVRE, null, null))
                .toList();
        assentoSessaoRepository.saveAll(assentoSessoes);

        return new SessaoResponse(
                sessaoSalva.getId(), sala.getId(), sala.getNome(), sessaoSalva.getTmdbId(), sessaoSalva.getTitulo(),
                sessaoSalva.getPosterUrl(), sessaoSalva.getSinopse(), request.dataEstreia(),
                sessaoSalva.getDataHora(), sessaoSalva.getPreco(), capacidade, organizador.getId());
    }

    @Transactional
    public SessaoResponse editar(Long id, EditarSessaoRequest request, String organizadorEmail) {
        Usuario organizador = usuarioRepository
                .findByEmail(organizadorEmail)
                .orElseThrow(OrganizadorNaoEncontradoException::new);

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Sessao sessao = sessaoRepository.findByIdForUpdate(id).orElseThrow(SessaoNaoEncontradaException::new);

        // Ownership vem antes de qualquer validação de corpo (AC2): tentar editar sessão de outro
        // organizador é sempre 403, mesmo sabendo o ID e mesmo com corpo malformado — não pode
        // vazar um 400 antes de confirmar o dono.
        if (!sessao.getOrganizadorId().equals(organizador.getId())) {
            throw new SessaoNaoPertenceAoOrganizadorException();
        }
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
            // se perde ao trocar o mapa de assentos pra sala nova.
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(id));
            List<Assento> assentos = assentoRepository.findBySalaId(sala.getId());
            if (assentos.isEmpty()) {
                throw new SalaSemAssentosException();
            }
            List<AssentoSessao> assentoSessoes = assentos.stream()
                    .map(assento -> new AssentoSessao(new AssentoSessaoId(id, assento.getId()), STATUS_LIVRE, null, null))
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
                sessaoSalva.getDataHora(), sessaoSalva.getPreco(), capacidade, organizador.getId());
    }

    public List<SessaoGestaoDto> listarMinhas(String organizadorEmail) {
        Usuario organizador = usuarioRepository
                .findByEmail(organizadorEmail)
                .orElseThrow(OrganizadorNaoEncontradoException::new);
        return sessaoRepository.findByOrganizadorId(organizador.getId()).stream()
                .map(projecao -> new SessaoGestaoDto(
                        projecao.getId(), projecao.getSalaId(), projecao.getSalaNome(), projecao.getTitulo(),
                        projecao.getSinopse(), projecao.getDataHora(), projecao.getPreco(), projecao.getCapacidade(),
                        projecao.getEditavel()))
                .toList();
    }

    public SessaoGestaoDto buscarPorId(Long id, String organizadorEmail) {
        Usuario organizador = usuarioRepository
                .findByEmail(organizadorEmail)
                .orElseThrow(OrganizadorNaoEncontradoException::new);
        Sessao sessao = sessaoRepository.findById(id).orElseThrow(SessaoNaoEncontradaException::new);
        if (!sessao.getOrganizadorId().equals(organizador.getId())) {
            throw new SessaoNaoPertenceAoOrganizadorException();
        }
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        int capacidade = assentoSessaoRepository.findByIdSessaoId(id).size();
        boolean editavel = !sessaoRepository.existeIngressoConfirmado(id);
        return new SessaoGestaoDto(
                sessao.getId(), sala.getId(), sala.getNome(), sessao.getTitulo(), sessao.getSinopse(),
                sessao.getDataHora(), sessao.getPreco(), capacidade, editavel);
    }

    public List<SessaoListagemDto> listarPublicadas() {
        return sessaoRepository.listarPublicadas().stream()
                .map(projecao -> new SessaoListagemDto(
                        projecao.getId(), projecao.getSalaNome(), projecao.getTmdbId(), projecao.getTitulo(),
                        projecao.getPosterUrl(), projecao.getSinopse(), projecao.getDataEstreia(),
                        projecao.getDataHora(), projecao.getPreco(), projecao.getCapacidade(),
                        projecao.getAssentosLivres() == 0))
                .toList();
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
}
