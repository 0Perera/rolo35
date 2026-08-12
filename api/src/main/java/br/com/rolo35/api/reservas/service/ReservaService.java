package br.com.rolo35.api.reservas.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.reservas.AssentoEmDisputaException;
import br.com.rolo35.api.reservas.AssentoIndisponivelException;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.SelecaoAssentosInvalidaException;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.StatusAssento;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
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
    private final EntityManager entityManager;

    public ReservaService(
            AssentoSessaoRepository assentoSessaoRepository, ReservaRepository reservaRepository,
            UsuarioRepository usuarioRepository, EntityManager entityManager) {
        this.assentoSessaoRepository = assentoSessaoRepository;
        this.reservaRepository = reservaRepository;
        this.usuarioRepository = usuarioRepository;
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

    // Duplica a regra de TTL lazy já usada em SessaoService.statusEfetivo (AD-4) em vez de
    // importar o método privado de lá — reservas depende de sessoes, nunca o inverso (AD-1).
    private boolean statusEfetivoLivre(AssentoSessao assento, LocalDateTime agora) {
        boolean holdVencido = StatusAssento.RESERVADO.name().equals(assento.getStatus())
                && assento.getExpiresAt() != null
                && assento.getExpiresAt().isBefore(agora);
        return holdVencido || StatusAssento.LIVRE.name().equals(assento.getStatus());
    }
}
