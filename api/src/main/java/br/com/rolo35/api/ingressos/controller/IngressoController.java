package br.com.rolo35.api.ingressos.controller;

import br.com.rolo35.api.common.PaginaDto;
import br.com.rolo35.api.ingressos.dto.IngressoPublicoDto;
import br.com.rolo35.api.ingressos.dto.IngressoResumoDto;
import br.com.rolo35.api.ingressos.service.IngressoService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ingressos")
public class IngressoController {

    private final IngressoService ingressoService;

    public IngressoController(IngressoService ingressoService) {
        this.ingressoService = ingressoService;
    }

    /**
     * Mesmo envelope e mesmos nomes de parâmetro de {@code GET /api/sessoes}: a carteira reusa o
     * componente de paginação da vitrine, e contrato divergente entre duas listas do mesmo app só
     * criaria caso especial no front.
     */
    @GetMapping("/minhas")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<PaginaDto<IngressoResumoDto>> minhas(
            Authentication authentication,
            @RequestParam(name = "pagina", defaultValue = "0") int pagina,
            @RequestParam(name = "tamanho", defaultValue = "12") int tamanho) {
        return ResponseEntity.ok(ingressoService.listarMinhas(authentication.getName(), pagina, tamanho));
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<IngressoPublicoDto> buscarPublico(@PathVariable String codigo) {
        return ResponseEntity.ok(ingressoService.buscarPublico(codigo));
    }
}
