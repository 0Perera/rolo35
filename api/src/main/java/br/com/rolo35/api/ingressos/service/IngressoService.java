package br.com.rolo35.api.ingressos.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.common.Paginacao;
import br.com.rolo35.api.common.PaginaDto;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.IngressoNaoEncontradoException;
import br.com.rolo35.api.ingressos.dto.IngressoPublicoDto;
import br.com.rolo35.api.ingressos.dto.IngressoResumoDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class IngressoService {

    private final IngressoRepository ingressoRepository;
    private final UsuarioRepository usuarioRepository;
    private final SessaoRepository sessaoRepository;
    private final SalaRepository salaRepository;
    private final CodigoIngressoService codigoIngressoService;

    public IngressoService(
            IngressoRepository ingressoRepository, UsuarioRepository usuarioRepository,
            SessaoRepository sessaoRepository, SalaRepository salaRepository,
            CodigoIngressoService codigoIngressoService) {
        this.ingressoRepository = ingressoRepository;
        this.usuarioRepository = usuarioRepository;
        this.sessaoRepository = sessaoRepository;
        this.salaRepository = salaRepository;
        this.codigoIngressoService = codigoIngressoService;
    }

    /**
     * Carteira paginada. O código assinado de cada ingresso é gerado por linha devolvida, então
     * página sem teto significaria assinar a carteira inteira a cada abertura da tela — o custo
     * cresce com o histórico do cliente, que só aumenta.
     */
    public PaginaDto<IngressoResumoDto> listarMinhas(String clienteEmail, int pagina, int tamanho) {
        Usuario cliente =
                usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);
        return PaginaDto.de(
                ingressoRepository.buscarPorCliente(cliente.getId(), Paginacao.de(pagina, tamanho)),
                p -> new IngressoResumoDto(
                        p.getId(), p.getStatus(), p.getAssentoFileira(), p.getAssentoNumero(),
                        p.getSessaoTitulo(), p.getSessaoPosterUrl(), p.getSalaNome(), p.getDataHora(),
                        codigoIngressoService.gerar(p.getId()),
                        p.getCodigoCurto()));
    }

    // Assinatura checada antes de qualquer consulta ao banco (AC5, AD-8): um código com HMAC
    // inválido nunca toca ingressoRepository — evita usar a rota pública como oráculo pra
    // diferenciar "não existe" de "assinatura errada".
    public IngressoPublicoDto buscarPublico(String codigo) {
        UUID id = codigoIngressoService.extrairId(codigo).orElseThrow(IngressoNaoEncontradoException::new);
        if (!codigoIngressoService.validar(id, codigo)) {
            throw new IngressoNaoEncontradoException();
        }
        Ingresso ingresso = ingressoRepository.findById(id).orElseThrow(IngressoNaoEncontradoException::new);
        Sessao sessao = sessaoRepository.findById(ingresso.getSessaoId()).orElseThrow(SessaoNaoEncontradaException::new);
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        return new IngressoPublicoDto(
                sessao.getTitulo(),
                sala.getNome(),
                sessao.getDataHora(),
                ingresso.getStatus(),
                ingresso.getCodigoCurto());
    }
}
