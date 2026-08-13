package br.com.rolo35.api.reservas.controller;

import br.com.rolo35.api.reservas.dto.ReservaCheckoutDto;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.service.ReservaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reservas")
public class ReservaController {

    private final ReservaService reservaService;

    public ReservaController(ReservaService reservaService) {
        this.reservaService = reservaService;
    }

    @PostMapping
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<ReservaDto> reservar(
            @Valid @RequestBody ReservarAssentosRequest request, Authentication authentication) {
        return ResponseEntity.ok(reservaService.reservar(request, authentication.getName()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<ReservaCheckoutDto> buscarParaCheckout(
            @PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(reservaService.buscarParaCheckout(id, authentication.getName()));
    }
}
