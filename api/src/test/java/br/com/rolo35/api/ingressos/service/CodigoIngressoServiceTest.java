package br.com.rolo35.api.ingressos.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CodigoIngressoServiceTest {

    private final CodigoIngressoService service = new CodigoIngressoService("segredo-de-teste-fixo-para-hmac");

    @Test
    void geraCodigoNoFormatoUuidPontoAssinatura() {
        UUID id = UUID.randomUUID();

        String codigo = service.gerar(id);

        assertThat(codigo).startsWith(id + ".");
        assertThat(codigo.split("\\.", 2)).hasSize(2);
    }

    @Test
    void validaCodigoRecemGeradoComoValido() {
        UUID id = UUID.randomUUID();
        String codigo = service.gerar(id);

        assertThat(service.validar(id, codigo)).isTrue();
    }

    @Test
    void rejeitaCodigoComAssinaturaAdulterada() {
        UUID id = UUID.randomUUID();
        String codigo = service.gerar(id);
        int posicaoAssinatura = codigo.indexOf('.') + 1;
        char original = codigo.charAt(posicaoAssinatura);
        char trocado = original == 'A' ? 'B' : 'A';
        String adulterado = codigo.substring(0, posicaoAssinatura) + trocado + codigo.substring(posicaoAssinatura + 1);

        assertThat(service.validar(id, adulterado)).isFalse();
    }

    @Test
    void rejeitaAssinaturaDeOutroIdColadaNoPrimeiroId() {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        String codigo1 = service.gerar(id1);
        String codigo2 = service.gerar(id2);
        String assinatura2 = codigo2.split("\\.", 2)[1];
        String codigoForjado = id1 + "." + assinatura2;

        assertThat(service.validar(id1, codigoForjado)).isFalse();
    }

    @Test
    void extrairIdDevolveUuidDoCodigoGerado() {
        UUID id = UUID.randomUUID();
        String codigo = service.gerar(id);

        assertThat(service.extrairId(codigo)).contains(id);
    }

    @Test
    void extrairIdDevolveVazioParaCodigoSemPonto() {
        assertThat(service.extrairId("sem-ponto-nenhum")).isEqualTo(Optional.empty());
    }

    @Test
    void extrairIdDevolveVazioParaUuidMalformado() {
        assertThat(service.extrairId("nao-e-um-uuid.assinatura")).isEqualTo(Optional.empty());
    }
}
