package br.com.rolo35.api.ingressos.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.PortariaNaoEncontradaException;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.repository.TurnoPortariaRepository;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortariaService {

    private final UsuarioRepository usuarioRepository;
    private final SessaoRepository sessaoRepository;
    private final SalaRepository salaRepository;
    private final TurnoPortariaRepository turnoPortariaRepository;

    public PortariaService(
            UsuarioRepository usuarioRepository, SessaoRepository sessaoRepository, SalaRepository salaRepository,
            TurnoPortariaRepository turnoPortariaRepository) {
        this.usuarioRepository = usuarioRepository;
        this.sessaoRepository = sessaoRepository;
        this.salaRepository = salaRepository;
        this.turnoPortariaRepository = turnoPortariaRepository;
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

    private SessaoAtivaDto montarDto(Sessao sessao) {
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        return new SessaoAtivaDto(sessao.getId(), sessao.getTitulo(), sala.getNome(), sessao.getDataHora());
    }
}
