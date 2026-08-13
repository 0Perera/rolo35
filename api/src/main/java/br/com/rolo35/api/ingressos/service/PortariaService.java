package br.com.rolo35.api.ingressos.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.IngressoEmDisputaException;
import br.com.rolo35.api.ingressos.PortariaNaoEncontradaException;
import br.com.rolo35.api.ingressos.ResultadoValidacao;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.repository.TurnoPortariaRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoNaoEncontradoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortariaService {

    private final UsuarioRepository usuarioRepository;
    private final SessaoRepository sessaoRepository;
    private final SalaRepository salaRepository;
    private final TurnoPortariaRepository turnoPortariaRepository;
    private final IngressoRepository ingressoRepository;
    private final AssentoRepository assentoRepository;
    private final CodigoIngressoService codigoIngressoService;
    private final EntityManager entityManager;

    public PortariaService(
            UsuarioRepository usuarioRepository, SessaoRepository sessaoRepository, SalaRepository salaRepository,
            TurnoPortariaRepository turnoPortariaRepository, IngressoRepository ingressoRepository,
            AssentoRepository assentoRepository, CodigoIngressoService codigoIngressoService,
            EntityManager entityManager) {
        this.usuarioRepository = usuarioRepository;
        this.sessaoRepository = sessaoRepository;
        this.salaRepository = salaRepository;
        this.turnoPortariaRepository = turnoPortariaRepository;
        this.ingressoRepository = ingressoRepository;
        this.assentoRepository = assentoRepository;
        this.codigoIngressoService = codigoIngressoService;
        this.entityManager = entityManager;
    }

    @Transactional
    public SessaoAtivaDto selecionarSessao(String portariaEmail, Long sessaoId) {
        Usuario portaria = usuarioRepository.findByEmail(portariaEmail).orElseThrow(PortariaNaoEncontradaException::new);
        Sessao sessao = sessaoRepository.findById(sessaoId).orElseThrow(SessaoNaoEncontradaException::new);
        turnoPortariaRepository.save(new TurnoPortaria(portaria.getId(), sessao.getId(), LocalDateTime.now()));
        return montarDto(sessao);
    }

    @Transactional(readOnly = true)
    public SessaoAtivaDto sessaoAtiva(String portariaEmail) {
        return montarDto(obterSessaoAtivaOuLancar(portariaEmail));
    }

    @Transactional(readOnly = true)
    public Sessao obterSessaoAtivaOuLancar(String portariaEmail) {
        Usuario portaria = usuarioRepository.findByEmail(portariaEmail).orElseThrow(PortariaNaoEncontradaException::new);
        TurnoPortaria turno = turnoPortariaRepository
                .findById(portaria.getId())
                .orElseThrow(SessaoAtivaNaoSelecionadaException::new);
        return sessaoRepository.findById(turno.getSessaoId()).orElseThrow(SessaoNaoEncontradaException::new);
    }

    @Transactional
    public ValidacaoIngressoDto validar(String portariaEmail, String codigo) {
        Sessao sessaoAtiva = obterSessaoAtivaOuLancar(portariaEmail);

        Optional<UUID> idOptional = codigoIngressoService.extrairId(codigo);
        if (idOptional.isEmpty() || !codigoIngressoService.validar(idOptional.get(), codigo)) {
            return new ValidacaoIngressoDto(ResultadoValidacao.INVALIDO, null, null, null);
        }

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Ingresso ingresso;
        try {
            ingresso = ingressoRepository.findByIdForUpdate(idOptional.get()).orElse(null);
        } catch (PessimisticLockingFailureException e) {
            throw new IngressoEmDisputaException();
        }
        if (ingresso == null) {
            return new ValidacaoIngressoDto(ResultadoValidacao.INVALIDO, null, null, null);
        }

        Assento assento = assentoRepository.findById(ingresso.getAssentoId()).orElseThrow(AssentoNaoEncontradoException::new);

        if (!ingresso.getSessaoId().equals(sessaoAtiva.getId())) {
            return new ValidacaoIngressoDto(
                    ResultadoValidacao.EVENTO_ERRADO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
        }
        if (ingresso.getStatus() == StatusIngresso.UTILIZADO) {
            return new ValidacaoIngressoDto(
                    ResultadoValidacao.JA_UTILIZADO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
        }

        ingresso.validar();
        ingressoRepository.save(ingresso);
        return new ValidacaoIngressoDto(
                ResultadoValidacao.VALIDO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
    }

    private SessaoAtivaDto montarDto(Sessao sessao) {
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        return new SessaoAtivaDto(sessao.getId(), sessao.getTitulo(), sala.getNome(), sessao.getDataHora());
    }
}
