package br.com.rolo35.api.reservas.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.common.NaoAutorizadoException;
import br.com.rolo35.api.reservas.AssentoEmDisputaException;
import br.com.rolo35.api.reservas.AssentoIndisponivelException;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.SelecaoAssentosInvalidaException;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.dto.AssentoReservadoDto;
import br.com.rolo35.api.reservas.dto.ReservaCheckoutDto;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.SessaoJaComecouException;
import br.com.rolo35.api.sessoes.StatusAssento;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.ReservaCheckoutProjection;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReservaService {

    private static final int MAX_ASSENTOS = 6;
    private static final int MINUTOS_HOLD = 10;

    private final AssentoSessaoRepository assentoSessaoRepository;
    private final ReservaRepository reservaRepository;
    private final UsuarioRepository usuarioRepository;
    private final SessaoRepository sessaoRepository;
    private final EntityManager entityManager;

    public ReservaService(
            AssentoSessaoRepository assentoSessaoRepository, ReservaRepository reservaRepository,
            UsuarioRepository usuarioRepository, SessaoRepository sessaoRepository, EntityManager entityManager) {
        this.assentoSessaoRepository = assentoSessaoRepository;
        this.reservaRepository = reservaRepository;
        this.usuarioRepository = usuarioRepository;
        this.sessaoRepository = sessaoRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public ReservaDto reservar(ReservarAssentosRequest request, String clienteEmail) {
        // Validação de forma roda antes de qualquer lock (AC6): a transação que segura as
        // linhas de assento_sessao precisa ser a mais curta possível (AD-5).
        List<Long> assentoIds = request.assentoIds();
        if (assentoIds.isEmpty() || assentoIds.size() > MAX_ASSENTOS
                || assentoIds.size() != Set.copyOf(assentoIds).size()) {
            throw new SelecaoAssentosInvalidaException();
        }

        Usuario cliente =
                usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);

        // FR-10: a vitrine só lista sessão futura, mas a aba aberta há uma hora não sabe disso —
        // sem este guard, o mapa de assentos de uma sessão que já começou continuava vendendo.
        // Também roda antes do lock: nada aqui depende das linhas de assento_sessao (AD-5).
        if (sessaoRepository.jaComecou(request.sessaoId())) {
            throw new SessaoJaComecouException();
        }

        recolherHoldAnterior(cliente.getId(), request.sessaoId());

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        List<AssentoSessao> travados;
        try {
            travados = assentoSessaoRepository.travarParaReserva(request.sessaoId(), assentoIds);
        } catch (PessimisticLockingFailureException e) {
            // Timeout do lock_timeout de 3s não significa que o assento está indisponível — só que
            // não deu pra confirmar isso a tempo (outra transação segurava a linha). Diferente de
            // AssentoIndisponivelException (checagem concluída, negativa), aqui o cliente pode
            // tentar de novo com os mesmos assentos e funcionar.
            throw new AssentoEmDisputaException();
        }

        LocalDateTime agora = LocalDateTime.now();
        boolean algumIndisponivel = travados.size() != assentoIds.size()
                || travados.stream().anyMatch(assento -> !statusEfetivoLivre(assento, agora));
        if (algumIndisponivel) {
            throw new AssentoIndisponivelException();
        }

        LocalDateTime expiraEm = agora.plusMinutes(MINUTOS_HOLD);
        Reserva reserva = reservaRepository.save(
                new Reserva(null, cliente.getId(), request.sessaoId(), StatusReserva.ATIVA, Instant.now(), expiraEm));
        int linhasAfetadas =
                assentoSessaoRepository.reivindicar(request.sessaoId(), assentoIds, reserva.getId(), expiraEm, agora);
        if (linhasAfetadas != assentoIds.size()) {
            throw new AssentoIndisponivelException();
        }

        return new ReservaDto(reserva.getId(), request.sessaoId(), reserva.getStatus(), expiraEm, assentoIds);
    }

    /**
     * Devolve à sala o hold que este cliente já tinha nesta sessão, antes de montar o novo.
     *
     * <p>Existe por causa do caminho mais banal do fluxo: escolher assentos, ir pro checkout e
     * voltar pra trocar. Sem isto, o hold antigo seguia de pé — o cliente saía segurando dois
     * conjuntos, e o abandonado ficava bloqueado até o TTL de 10min vencer, pra todo mundo. Numa
     * sessão cheia isso é venda perdida, não só incômodo.
     *
     * <p>Roda <b>antes</b> do lock dos assentos novos de propósito: é o que permite reescolher
     * exatamente os mesmos lugares. Liberando depois, a checagem de disponibilidade ainda veria o
     * próprio hold do cliente e recusaria com {@code AssentoIndisponivelException} — o sintoma
     * original.
     *
     * <p>Depois da validação de forma (AD-5): um clique com seleção inválida não pode destruir o
     * hold que o cliente já tinha.
     */
    private void recolherHoldAnterior(Long clienteId, Long sessaoId) {
        for (Reserva anterior : reservaRepository.buscarAtivasDoClienteNaSessaoForUpdate(clienteId, sessaoId)) {
            assentoSessaoRepository.liberarPorReserva(anterior.getId());
            anterior.cancelar();
            reservaRepository.save(anterior);
        }
    }

    /**
     * Leitura pura pra retomar o checkout: reserva de outro cliente e reserva inexistente caem na
     * mesma exceção, pelo mesmo motivo de PagamentoService.confirmar() — a resposta não pode servir
     * de oráculo de quais reservaId existem.
     *
     * <p>Sem {@code findByIdForUpdate} de propósito: travar a reserva a cada abertura da tela (e a
     * cada F5) criaria contenção contra o POST de pagamento do próprio cliente, que é o gargalo do
     * fluxo. Aqui não há escrita nenhuma pra proteger.
     */
    @Transactional(readOnly = true)
    public ReservaCheckoutDto buscarParaCheckout(Long reservaId, String clienteEmail) {
        Usuario cliente =
                usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);

        Reserva reserva = reservaRepository
                .findById(reservaId)
                .filter(r -> r.getClienteId().equals(cliente.getId()))
                .orElseThrow(NaoAutorizadoException::new);

        // Reserva recusada não tem mais assentos: liberar() zera reserva_id das linhas. O contexto
        // da sessão vem junto de cada assento, então nesse caso ele simplesmente não existe — quem
        // consome decide o que mostrar pelo status, não pela lista.
        List<ReservaCheckoutProjection> assentos = assentoSessaoRepository.buscarAssentosDaReserva(reservaId);
        Optional<ReservaCheckoutProjection> contexto = assentos.stream().findFirst();

        return new ReservaCheckoutDto(
                reserva.getId(),
                reserva.getSessaoId(),
                reserva.getStatus(),
                reserva.getExpiresAt(),
                contexto.map(ReservaCheckoutProjection::getSessaoTitulo).orElse(null),
                contexto.map(ReservaCheckoutProjection::getSalaNome).orElse(null),
                contexto.map(ReservaCheckoutProjection::getDataHora).orElse(null),
                contexto.map(ReservaCheckoutProjection::getPreco).orElse(null),
                assentos.stream()
                        .map(assento -> new AssentoReservadoDto(
                                assento.getAssentoId(), assento.getFileira(), assento.getNumero()))
                        .toList());
    }

    // Duplica a regra de TTL lazy já usada em SessaoService.statusEfetivo (AD-4) em vez de
    // importar o método privado de lá — reservas depende de sessoes, nunca o inverso (AD-1).
    private boolean statusEfetivoLivre(AssentoSessao assento, LocalDateTime agora) {
        boolean holdVencido = assento.getStatus() == StatusAssento.RESERVADO
                && assento.getExpiresAt() != null
                && assento.getExpiresAt().isBefore(agora);
        return holdVencido || assento.getStatus() == StatusAssento.LIVRE;
    }
}
