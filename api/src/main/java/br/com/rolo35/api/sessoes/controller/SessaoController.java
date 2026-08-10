package br.com.rolo35.api.sessoes.controller;

import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.service.SessaoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
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
    public ResponseEntity<SessaoResponse> criar(
            @Valid @RequestBody CriarSessaoRequest request, Authentication authentication) {
        SessaoResponse resposta = sessaoService.criar(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(resposta);
    }
}
