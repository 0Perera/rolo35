package br.com.rolo35.api.ingressos.controller;

import br.com.rolo35.api.ingressos.dto.IngressoPublicoDto;
import br.com.rolo35.api.ingressos.dto.IngressoResumoDto;
import br.com.rolo35.api.ingressos.service.IngressoService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ingressos")
public class IngressoController {

    private final IngressoService ingressoService;

    public IngressoController(IngressoService ingressoService) {
        this.ingressoService = ingressoService;
    }

    @GetMapping("/minhas")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<List<IngressoResumoDto>> minhas(Authentication authentication) {
        return ResponseEntity.ok(ingressoService.listarMinhas(authentication.getName()));
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<IngressoPublicoDto> buscarPublico(@PathVariable String codigo) {
        return ResponseEntity.ok(ingressoService.buscarPublico(codigo));
    }
}
