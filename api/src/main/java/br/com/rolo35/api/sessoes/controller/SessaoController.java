package br.com.rolo35.api.sessoes.controller;

import br.com.rolo35.api.common.PaginaDto;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.MapaAssentosDto;
import br.com.rolo35.api.sessoes.dto.OcupacaoSalaDto;
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
import org.springframework.web.bind.annotation.RequestParam;
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

    /**
     * Página numerada, não cursor: a tela oferece "ir pra página 2", e keyset só sabe avançar e
     * voltar de um em um. O custo do offset é conhecido e aceito nesse volume; o que a paginação
     * não pode é ficar sem ordenação determinística nem sem teto de tamanho — as duas coisas vivem
     * na query e no service, não aqui.
     */
    @GetMapping
    public ResponseEntity<PaginaDto<SessaoListagemDto>> listar(
            @RequestParam(name = "q", required = false) String busca,
            @RequestParam(name = "tmdbId", required = false) Long tmdbId,
            @RequestParam(name = "salaId", required = false) Long salaId,
            @RequestParam(name = "pagina", defaultValue = "0") int pagina,
            @RequestParam(name = "tamanho", defaultValue = "12") int tamanho) {
        return ResponseEntity.ok(sessaoService.listarPublicadas(busca, tmdbId, salaId, pagina, tamanho));
    }

    /**
     * Agenda de gestão do cinema: qualquer ORGANIZADOR vê e edita qualquer sessão. Era
     * {@code /minhas} até CAP-1 — o nome antigo prometia um recorte por dono que não existe mais.
     */
    @GetMapping("/gestao")
    @PreAuthorize("hasRole('ORGANIZADOR')")
    public ResponseEntity<PaginaDto<SessaoGestaoDto>> listarParaGestao(
            Authentication authentication,
            @RequestParam(name = "pagina", defaultValue = "0") int pagina,
            @RequestParam(name = "tamanho", defaultValue = "12") int tamanho) {
        return ResponseEntity.ok(sessaoService.listarParaGestao(authentication.getName(), pagina, tamanho));
    }

    /**
     * Path fixo declarado antes de {@code /{id}} — o Spring resolve por especificidade e não por
     * ordem, mas manter os dois vizinhos deixa visível que {@code ocupacao} nunca pode virar um id.
     */
    @GetMapping("/ocupacao")
    @PreAuthorize("hasRole('ORGANIZADOR')")
    public ResponseEntity<List<OcupacaoSalaDto>> ocupacaoDaSala(@RequestParam(name = "salaId") Long salaId) {
        return ResponseEntity.ok(sessaoService.listarOcupacaoDaSala(salaId));
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

    /**
     * Rota pública, mas que aproveita o token quando ele vem: o filtro JWT roda em toda requisição
     * (não tem {@code shouldNotFilter}), então visitante deslogado chega com {@code authentication}
     * nulo e cliente logado chega identificado. É isso que deixa o mapa marcar o hold do próprio
     * cliente sem fechar a rota.
     */
    @GetMapping("/{id}/mapa-assentos")
    public ResponseEntity<MapaAssentosDto> mapaAssentos(@PathVariable Long id, Authentication authentication) {
        String clienteEmail = authentication == null ? null : authentication.getName();
        return ResponseEntity.ok(sessaoService.mapaAssentos(id, clienteEmail));
    }
}
