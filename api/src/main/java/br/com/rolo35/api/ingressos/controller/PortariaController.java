package br.com.rolo35.api.ingressos.controller;

import br.com.rolo35.api.ingressos.dto.PainelTurnoDto;
import br.com.rolo35.api.ingressos.dto.SelecionarSessaoRequest;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.dto.ValidarIngressoRequest;
import br.com.rolo35.api.ingressos.service.PortariaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portaria")
public class PortariaController {

    private final PortariaService portariaService;

    public PortariaController(PortariaService portariaService) {
        this.portariaService = portariaService;
    }

    @PostMapping("/turno")
    @PreAuthorize("hasRole('PORTARIA')")
    public ResponseEntity<SessaoAtivaDto> selecionarSessao(
            @Valid @RequestBody SelecionarSessaoRequest request, Authentication authentication) {
        return ResponseEntity.ok(portariaService.selecionarSessao(authentication.getName(), request.sessaoId()));
    }

    @GetMapping("/turno")
    @PreAuthorize("hasRole('PORTARIA')")
    public ResponseEntity<SessaoAtivaDto> sessaoAtiva(Authentication authentication) {
        return ResponseEntity.ok(portariaService.sessaoAtiva(authentication.getName()));
    }

    @GetMapping("/turno/painel")
    @PreAuthorize("hasRole('PORTARIA')")
    public ResponseEntity<PainelTurnoDto> painelDoTurno(Authentication authentication) {
        return ResponseEntity.ok(portariaService.painelDoTurno(authentication.getName()));
    }

    @PostMapping("/validacoes")
    @PreAuthorize("hasRole('PORTARIA')")
    public ResponseEntity<ValidacaoIngressoDto> validar(
            @Valid @RequestBody ValidarIngressoRequest request, Authentication authentication) {
        return ResponseEntity.ok(portariaService.validar(authentication.getName(), request.codigo()));
    }
}
