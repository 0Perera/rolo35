package br.com.rolo35.api.sessoes.controller;

import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.MapaAssentosDto;
import br.com.rolo35.api.sessoes.dto.SessaoGestaoDto;
import br.com.rolo35.api.sessoes.dto.SessaoListagemDto;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.service.SessaoService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessoes")
public class SessaoController {

    private final SessaoService sessaoService;

    public SessaoController(SessaoService sessaoService) {
        this.sessaoService = sessaoService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ORGANIZADOR')")
    public ResponseEntity<SessaoResponse> criar(
            @Valid @RequestBody CriarSessaoRequest request, Authentication authentication) {
        SessaoResponse resposta = sessaoService.criar(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(resposta);
    }

    @GetMapping
    public ResponseEntity<List<SessaoListagemDto>> listar() {
        return ResponseEntity.ok(sessaoService.listarPublicadas());
    }

    @GetMapping("/minhas")
    @PreAuthorize("hasRole('ORGANIZADOR')")
    public ResponseEntity<List<SessaoGestaoDto>> listarMinhas(Authentication authentication) {
        return ResponseEntity.ok(sessaoService.listarMinhas(authentication.getName()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ORGANIZADOR')")
    public ResponseEntity<SessaoGestaoDto> buscarPorId(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(sessaoService.buscarPorId(id, authentication.getName()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ORGANIZADOR')")
    public ResponseEntity<SessaoResponse> editar(
            @PathVariable Long id, @Valid @RequestBody EditarSessaoRequest request, Authentication authentication) {
        return ResponseEntity.ok(sessaoService.editar(id, request, authentication.getName()));
    }

    @GetMapping("/{id}/mapa-assentos")
    public ResponseEntity<MapaAssentosDto> mapaAssentos(@PathVariable Long id) {
        return ResponseEntity.ok(sessaoService.mapaAssentos(id));
    }
}
