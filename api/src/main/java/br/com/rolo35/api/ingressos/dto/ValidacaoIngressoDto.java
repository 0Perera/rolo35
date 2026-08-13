package br.com.rolo35.api.ingressos.dto;

import br.com.rolo35.api.ingressos.ResultadoValidacao;

public record ValidacaoIngressoDto(
        ResultadoValidacao resultado, String assentoFileira, Integer assentoNumero, String sessaoTitulo) {}
