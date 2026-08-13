package br.com.rolo35.api.common;

import br.com.rolo35.api.auth.CredenciaisInvalidasException;
import br.com.rolo35.api.ingressos.IngressoNaoEncontradoException;
import br.com.rolo35.api.ingressos.PortariaNaoEncontradaException;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.pagamentos.ReservaEmDisputaException;
import br.com.rolo35.api.pagamentos.ReservaExpiradaException;
import br.com.rolo35.api.reservas.AssentoEmDisputaException;
import br.com.rolo35.api.reservas.AssentoIndisponivelException;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.reservas.SelecaoAssentosInvalidaException;
import br.com.rolo35.api.sessoes.DataEstreiaInvalidaException;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.HoldAtivoException;
import br.com.rolo35.api.sessoes.OrganizadorNaoEncontradoException;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.SalaSemAssentosException;
import br.com.rolo35.api.sessoes.SessaoComIngressoConfirmadoException;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.SessaoNaoPertenceAoOrganizadorException;
import br.com.rolo35.api.sessoes.catalogo.CatalogoIndisponivelException;
import br.com.rolo35.api.sessoes.catalogo.ParametroInvalidoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(CredenciaisInvalidasException.class)
    public ResponseEntity<ApiError> handleCredenciaisInvalidas() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("CREDENCIAIS_INVALIDAS", "E-mail ou senha inválidos"));
    }

    @ExceptionHandler(CatalogoIndisponivelException.class)
    public ResponseEntity<ApiError> handleCatalogoIndisponivel() {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError("CATALOGO_INDISPONIVEL", "Catálogo de filmes indisponível no momento"));
    }

    @ExceptionHandler({ParametroInvalidoException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiError> handleParametroInvalido() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("PARAMETRO_INVALIDO", "Parâmetro de busca inválido"));
    }

    // Falha de @Valid em corpo de requisição. Handler próprio (e não agrupado no de busca
    // acima) porque a mensagem precisa nomear os campos que falharam — quem cria uma sessão
    // não tem "parâmetro de busca" nenhum na tela.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleCorpoInvalido(MethodArgumentNotValidException exception) {
        String campos = exception.getBindingResult().getFieldErrors().stream()
                .map(erro -> erro.getField() + ": " + erro.getDefaultMessage())
                .sorted()
                .reduce((a, b) -> a + "; " + b)
                .orElse("corpo da requisição inválido");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError("PARAMETRO_INVALIDO", campos));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleCorpoIlegivel() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("CORPO_INVALIDO", "Corpo da requisição ausente ou em formato inválido"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTipoIncompativel() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("PARAMETRO_INVALIDO", "Parâmetro em formato inválido"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> handleMidiaNaoSuportada() {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(new ApiError("MIDIA_NAO_SUPORTADA", "Content-Type não suportado — use application/json"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMetodoNaoSuportado() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ApiError("METODO_NAO_SUPORTADO", "Método HTTP não suportado por este recurso"));
    }

    // @PreAuthorize nega dentro do DispatcherServlet, então a negação chega neste advice em vez
    // de passar pelo RestAccessDeniedHandler (que só cobre negação no nível da filter chain).
    // Os dois caminhos precisam devolver o mesmo envelope.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAcessoNegado() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError("NAO_AUTORIZADO", "Você não tem permissão para acessar este recurso"));
    }

    @ExceptionHandler(SessaoConflitanteException.class)
    public ResponseEntity<ApiError> handleSessaoConflitante() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("SESSAO_CONFLITANTE", "Já existe uma sessão nessa sala com horário conflitante"));
    }

    // Estouro do lock_timeout da transação de criação: a requisição é válida, o servidor só não
    // conseguiu a vez na fila da sala a tempo. 503 sinaliza "tente de novo", ao contrário de um
    // 500, que o cliente não tem motivo pra repetir.
    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleSalaOcupada(PessimisticLockingFailureException exception) {
        log.warn("Lock da sala não obtido dentro do timeout da transação", exception);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError("SALA_OCUPADA", "Outra criação de sessão para essa sala está em andamento. Tente novamente."));
    }

    @ExceptionHandler(DataHoraNoPassadoException.class)
    public ResponseEntity<ApiError> handleDataHoraNoPassado() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("DATA_HORA_NO_PASSADO", "Data e hora da sessão precisam estar no futuro"));
    }

    @ExceptionHandler(DataEstreiaInvalidaException.class)
    public ResponseEntity<ApiError> handleDataEstreiaInvalida() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("DATA_ESTREIA_INVALIDA", "Data de estreia precisa estar no formato AAAA-MM-DD"));
    }

    @ExceptionHandler(SalaNaoEncontradaException.class)
    public ResponseEntity<ApiError> handleSalaNaoEncontrada() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("SALA_NAO_ENCONTRADA", "Sala não encontrada"));
    }

    @ExceptionHandler(SalaSemAssentosException.class)
    public ResponseEntity<ApiError> handleSalaSemAssentos() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("SALA_SEM_ASSENTOS", "Sala não tem mapa de assentos cadastrado"));
    }

    @ExceptionHandler(SessaoNaoEncontradaException.class)
    public ResponseEntity<ApiError> handleSessaoNaoEncontrada() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("SESSAO_NAO_ENCONTRADA", "Sessão não encontrada"));
    }

    // Ownership: distinto do NAO_AUTORIZADO de papel errado (@PreAuthorize) — este é lançado pelo
    // service quando o organizador autenticado não é dono da sessão, mesmo sabendo o ID.
    @ExceptionHandler(SessaoNaoPertenceAoOrganizadorException.class)
    public ResponseEntity<ApiError> handleSessaoNaoPertenceAoOrganizador() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError("NAO_AUTORIZADO", "Você não tem permissão para acessar este recurso"));
    }

    @ExceptionHandler(SessaoComIngressoConfirmadoException.class)
    public ResponseEntity<ApiError> handleSessaoComIngressoConfirmado() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "SESSAO_COM_INGRESSO_CONFIRMADO", "Sessão já tem ingresso confirmado — nenhum campo pode ser editado"));
    }

    @ExceptionHandler(HoldAtivoException.class)
    public ResponseEntity<ApiError> handleHoldAtivo() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "SESSAO_COM_HOLD_ATIVO", "Sessão tem hold de reserva ativo — troque de sala só depois que ele expirar"));
    }

    @ExceptionHandler(OrganizadorNaoEncontradoException.class)
    public ResponseEntity<ApiError> handleOrganizadorNaoEncontrado() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("NAO_AUTENTICADO", "Usuário do token não existe mais"));
    }

    @ExceptionHandler(SelecaoAssentosInvalidaException.class)
    public ResponseEntity<ApiError> handleSelecaoAssentosInvalida() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("PARAMETRO_INVALIDO", "Seleção precisa ter de 1 a 6 assentos, sem duplicados"));
    }

    @ExceptionHandler(AssentoIndisponivelException.class)
    public ResponseEntity<ApiError> handleAssentoIndisponivel() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "ASSENTO_INDISPONIVEL", "Um ou mais assentos selecionados não estão mais disponíveis"));
    }

    @ExceptionHandler(ClienteNaoEncontradoException.class)
    public ResponseEntity<ApiError> handleClienteNaoEncontrado() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("NAO_AUTENTICADO", "Usuário do token não existe mais"));
    }

    // Distinto de AssentoIndisponivelException: aqui o lock_timeout de 3s estourou sem confirmar
    // se o assento está de fato ocupado — é incerteza de contenção, não uma checagem concluída.
    // 409 (não 503 como o SALA_OCUPADA de criação de sessão) porque o recurso em disputa é
    // identificável (os assentos da requisição), e a mensagem já orienta a tentar de novo.
    @ExceptionHandler(AssentoEmDisputaException.class)
    public ResponseEntity<ApiError> handleAssentoEmDisputa(AssentoEmDisputaException exception) {
        log.warn("Lock de assento não obtido dentro do timeout da transação", exception);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("ASSENTO_EM_DISPUTA", "Assento em disputa no momento — tente novamente"));
    }

    // Mesmo codigo/status de handleSessaoNaoPertenceAoOrganizador — é o mesmo conceito de negação
    // de acesso, sem o significado de domínio que o nome daquela exceção carrega no throw site.
    // Mora em common porque já atende pagamentos e reservas: uma cópia por domínio seria a
    // terceira classe Java pro mesmo par 403/NAO_AUTORIZADO.
    @ExceptionHandler(NaoAutorizadoException.class)
    public ResponseEntity<ApiError> handleNaoAutorizado() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError("NAO_AUTORIZADO", "Você não tem permissão para acessar este recurso"));
    }

    @ExceptionHandler(ReservaExpiradaException.class)
    public ResponseEntity<ApiError> handleReservaExpirada() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("RESERVA_EXPIRADA", "Reserva expirada — refaça a seleção de assentos"));
    }

    // Distinto de PessimisticLockingFailureException genérico (handleSalaOcupada, 503): aqui o
    // lock_timeout estourou travando uma Reserva específica pra pagamento, não uma Sala pra
    // criação de sessão — 409 com mensagem própria, mesmo raciocínio de handleAssentoEmDisputa.
    @ExceptionHandler(ReservaEmDisputaException.class)
    public ResponseEntity<ApiError> handleReservaEmDisputa(ReservaEmDisputaException exception) {
        log.warn("Lock de reserva não obtido dentro do timeout da transação", exception);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("RESERVA_EM_DISPUTA", "Reserva em disputa no momento — tente novamente"));
    }

    // Não existe / assinatura HMAC inválida devolvem a mesma resposta (AC5 da Story 4.2) — não
    // é possível diferenciar os dois motivos pela resposta, evita usar a rota como oráculo de
    // enumeração de UUIDs válidos.
    @ExceptionHandler(IngressoNaoEncontradoException.class)
    public ResponseEntity<ApiError> handleIngressoNaoEncontrado() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("INGRESSO_NAO_ENCONTRADO", "Ingresso não encontrado"));
    }

    @ExceptionHandler(SessaoAtivaNaoSelecionadaException.class)
    public ResponseEntity<ApiError> handleSessaoAtivaNaoSelecionada() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "SESSAO_ATIVA_NAO_SELECIONADA", "Selecione a sessão do turno antes de continuar"));
    }

    @ExceptionHandler(PortariaNaoEncontradaException.class)
    public ResponseEntity<ApiError> handlePortariaNaoEncontrada() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("NAO_AUTENTICADO", "Usuário do token não existe mais"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception exception) {
        log.error("Erro não tratado", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("ERRO_INTERNO", "Erro interno do servidor"));
    }
}
