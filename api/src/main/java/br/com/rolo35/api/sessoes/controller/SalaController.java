package br.com.rolo35.api.sessoes.controller;

import br.com.rolo35.api.sessoes.dto.SalaResumoDto;
import br.com.rolo35.api.sessoes.service.SalaService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SalaController {

    private final SalaService salaService;

    public SalaController(SalaService salaService) {
        this.salaService = salaService;
    }

    @GetMapping("/api/salas")
    public List<SalaResumoDto> listar() {
        return salaService.listar();
    }
}
