package br.com.rolo35.api.sessoes.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
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
        if (!request.dataHora().isAfter(LocalDateTime.now())) {
            throw new DataHoraNoPassadoException();
        }

        Usuario organizador = usuarioRepository.findByEmail(organizadorEmail).orElseThrow();

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Sala sala = salaRepository.findByIdForUpdate(request.salaId()).orElseThrow(SalaNaoEncontradaException::new);

        if (sessaoRepository.existeConflitante(sala.getId(), request.dataHora(), BUFFER_MINUTOS)) {
            throw new SessaoConflitanteException();
        }

        int capacidade = sala.getLinhas() * sala.getColunas();

        LocalDate dataEstreia = request.dataEstreia() != null ? LocalDate.parse(request.dataEstreia()) : null;
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

        List<Assento> assentos = assentoRepository.findBySalaId(sala.getId());
        List<AssentoSessao> assentoSessoes = assentos.stream()
                .map(assento -> AssentoSessao.builder()
                        .id(new AssentoSessaoId(sessaoSalva.getId(), assento.getId()))
                        .status("LIVRE")
                        .build())
                .toList();
        assentoSessaoRepository.saveAll(assentoSessoes);

        return new SessaoResponse(
                sessaoSalva.getId(), sala.getId(), sala.getNome(), sessaoSalva.getTmdbId(), sessaoSalva.getTitulo(),
                sessaoSalva.getPosterUrl(), sessaoSalva.getSinopse(), request.dataEstreia(),
                sessaoSalva.getDataHora(), sessaoSalva.getPreco(), capacidade, organizador.getId());
    }
}
