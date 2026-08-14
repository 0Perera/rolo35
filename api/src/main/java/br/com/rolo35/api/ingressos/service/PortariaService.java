package br.com.rolo35.api.ingressos.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.IngressoEmDisputaException;
import br.com.rolo35.api.ingressos.PortariaNaoEncontradaException;
import br.com.rolo35.api.ingressos.ResultadoValidacao;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.SessaoForaDaJanelaDoTurnoException;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.ingressos.dto.PainelTurnoDto;
import br.com.rolo35.api.ingressos.dto.PainelTurnoDto.LeituraTurnoDto;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.repository.TurnoPortariaRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoNaoEncontradoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortariaService {

    /**
     * O painel é conferência de turno, não relatório: o operador precisa das últimas leituras pra
     * responder "essa pessoa já entrou?". Sem teto, uma sessão lotada devolveria centenas de linhas
     * a cada validação, na frente da fila.
     */
    private static final int LIMITE_HISTORICO = 30;

    // Janela operacional pra ativar sessão como "sessão do turno" — não reaproveita o buffer de
    // 4h de conflito de sala (SessaoService): são conceitos diferentes, mesmo que o valor pareça
    // parecido. Decidido em spec-backlog-hardening (CAP-8).
    private static final long JANELA_TURNO_ANTES_MINUTOS = 30;
    private static final long JANELA_TURNO_DEPOIS_HORAS = 2;

    private final UsuarioRepository usuarioRepository;
    private final SessaoRepository sessaoRepository;
    private final SalaRepository salaRepository;
    private final TurnoPortariaRepository turnoPortariaRepository;
    private final IngressoRepository ingressoRepository;
    private final AssentoRepository assentoRepository;
    private final CodigoIngressoService codigoIngressoService;
    private final EntityManager entityManager;

    public PortariaService(
            UsuarioRepository usuarioRepository, SessaoRepository sessaoRepository, SalaRepository salaRepository,
            TurnoPortariaRepository turnoPortariaRepository, IngressoRepository ingressoRepository,
            AssentoRepository assentoRepository, CodigoIngressoService codigoIngressoService,
            EntityManager entityManager) {
        this.usuarioRepository = usuarioRepository;
        this.sessaoRepository = sessaoRepository;
        this.salaRepository = salaRepository;
        this.turnoPortariaRepository = turnoPortariaRepository;
        this.ingressoRepository = ingressoRepository;
        this.assentoRepository = assentoRepository;
        this.codigoIngressoService = codigoIngressoService;
        this.entityManager = entityManager;
    }

    @Transactional
    public SessaoAtivaDto selecionarSessao(String portariaEmail, Long sessaoId) {
        Usuario portaria = usuarioRepository.findByEmail(portariaEmail).orElseThrow(PortariaNaoEncontradaException::new);
        Sessao sessao = sessaoRepository.findById(sessaoId).orElseThrow(SessaoNaoEncontradaException::new);

        LocalDateTime agora = LocalDateTime.now();
        LocalDateTime inicioJanela = agora.minusHours(JANELA_TURNO_DEPOIS_HORAS);
        LocalDateTime fimJanela = agora.plusMinutes(JANELA_TURNO_ANTES_MINUTOS);
        if (sessao.getDataHora().isBefore(inicioJanela) || sessao.getDataHora().isAfter(fimJanela)) {
            throw new SessaoForaDaJanelaDoTurnoException();
        }

        turnoPortariaRepository.save(new TurnoPortaria(portaria.getId(), sessao.getId(), LocalDateTime.now()));
        return montarDto(sessao);
    }

    @Transactional(readOnly = true)
    public SessaoAtivaDto sessaoAtiva(String portariaEmail) {
        return montarDto(obterSessaoAtivaOuLancar(portariaEmail));
    }

    @Transactional(readOnly = true)
    public Sessao obterSessaoAtivaOuLancar(String portariaEmail) {
        Usuario portaria = usuarioRepository.findByEmail(portariaEmail).orElseThrow(PortariaNaoEncontradaException::new);
        TurnoPortaria turno = turnoPortariaRepository
                .findById(portaria.getId())
                .orElseThrow(SessaoAtivaNaoSelecionadaException::new);
        return sessaoRepository.findById(turno.getSessaoId()).orElseThrow(SessaoNaoEncontradaException::new);
    }

    @Transactional
    public ValidacaoIngressoDto validar(String portariaEmail, String codigo) {
        Sessao sessaoAtiva = obterSessaoAtivaOuLancar(portariaEmail);

        Ingresso ingresso = localizar(codigo);
        if (ingresso == null) {
            return new ValidacaoIngressoDto(ResultadoValidacao.INVALIDO, null, null, null);
        }

        Assento assento = assentoRepository.findById(ingresso.getAssentoId()).orElseThrow(AssentoNaoEncontradoException::new);

        if (!ingresso.getSessaoId().equals(sessaoAtiva.getId())) {
            return new ValidacaoIngressoDto(
                    ResultadoValidacao.EVENTO_ERRADO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
        }
        if (ingresso.getStatus() == StatusIngresso.UTILIZADO) {
            return new ValidacaoIngressoDto(
                    ResultadoValidacao.JA_UTILIZADO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
        }

        ingresso.validar();
        ingressoRepository.save(ingresso);
        return new ValidacaoIngressoDto(
                ResultadoValidacao.VALIDO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
    }

    /**
     * Resolve o texto lido — QR ou digitado — no ingresso correspondente, ou {@code null}.
     *
     * <p>Um formato só: o código curto. O QR carrega exatamente o que o operador digitaria, então a
     * câmera e o teclado convergem antes de chegar aqui. O código assinado por HMAC deixou de ser
     * credencial de portaria — sobrou como token do link público, que é a única superfície sem
     * autenticação e a única que ainda precisa de assinatura.
     *
     * <p>Todos os motivos de falha (formato recusado, código inexistente) devolvem {@code null} e
     * viram o mesmo {@code INVALIDO}, pelo mesmo raciocínio já registrado na Story 5.2: a resposta
     * não pode virar oráculo de quais códigos existem.
     */
    private Ingresso localizar(String codigo) {
        Optional<String> codigoCurto = codigoIngressoService.normalizarCodigoCurto(codigo);
        if (codigoCurto.isEmpty()) {
            return null;
        }

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        try {
            return codigoCurto.flatMap(ingressoRepository::findByCodigoCurtoForUpdate).orElse(null);
        } catch (PessimisticLockingFailureException e) {
            throw new IngressoEmDisputaException();
        }
    }

    /**
     * Painel do turno (FR-21): leitura pura sobre o que a validação já persistiu. Não adquire lock
     * e não transiciona nada — {@code POST /portaria/validacoes} continua sendo o único caminho de
     * {@code VALIDO → UTILIZADO} (AD-9).
     *
     * <p>Só entradas liberadas aparecem no histórico. Ingresso inválido, repetido ou de outra
     * sessão é recusado sem gravar nada, então não há de onde ler — registrar isso exigiria uma
     * tabela de auditoria escrita dentro da transação de {@link #validar}, que é o caminho
     * protegido por AD-5. Decisão registrada na Story 5.3.
     */
    @Transactional(readOnly = true)
    public PainelTurnoDto painelDoTurno(String portariaEmail) {
        Sessao sessaoAtiva = obterSessaoAtivaOuLancar(portariaEmail);
        List<LeituraTurnoDto> leituras =
                ingressoRepository.buscarLeiturasDoTurno(sessaoAtiva.getId(), PageRequest.of(0, LIMITE_HISTORICO))
                        .stream()
                        .map(leitura -> new LeituraTurnoDto(
                                leitura.getCodigoCurto(),
                                leitura.getAssentoFileira(),
                                leitura.getAssentoNumero(),
                                leitura.getValidadoEm()))
                        .toList();
        return new PainelTurnoDto(
                ingressoRepository.countBySessaoIdAndStatus(sessaoAtiva.getId(), StatusIngresso.UTILIZADO),
                ingressoRepository.countBySessaoId(sessaoAtiva.getId()),
                leituras);
    }

    private SessaoAtivaDto montarDto(Sessao sessao) {
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        return new SessaoAtivaDto(sessao.getId(), sessao.getTitulo(), sala.getNome(), sessao.getDataHora());
    }
}
