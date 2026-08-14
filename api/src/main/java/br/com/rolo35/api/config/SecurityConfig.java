package br.com.rolo35.api.config;

import br.com.rolo35.api.auth.JwtAuthenticationFilter;
import br.com.rolo35.api.auth.JwtService;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${cors.allowed-origins}")
    private List<String> corsAllowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, ObjectMapper objectMapper)
            throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Autenticação é decidida aqui; papel é decidido por @PreAuthorize no método do
                // controller, pra que uma rota nova não herde permissão por esquecimento de
                // matcher — sem anotação, ela simplesmente não passa.
                // Dois grupos de permitAll() intencionalmente separados: o primeiro libera
                // /api/auth/login, /api/auth/cadastro e /actuator/health em qualquer método; o
                // segundo libera só o método GET de /api/sessoes (POST /api/sessoes continua
                // exigindo autenticação + @PreAuthorize("hasRole('ORGANIZADOR')") no controller).
                // Não dá pra unificar num requestMatchers() só porque um grupo é por path e o outro
                // é por método+path.
                // /api/auth/cadastro é público de propósito: quem cria conta ainda não tem token, e
                // a Story 1.3 decidiu não gatear a escolha de papel por autorização. Path exato, e
                // não /api/auth/**, pra que uma rota de autenticação futura não nasça pública por
                // herança de matcher.
                .authorizeHttpRequests(auth -> auth.requestMatchers(
                                "/api/auth/login", "/api/auth/cadastro", "/actuator/health")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/sessoes")
                        .permitAll()
                        // Matcher próprio (não amplia o path exato acima): libera só o mapa de
                        // assentos de uma sessão específica. Ampliar pra /api/sessoes/** vazaria
                        // GET /api/sessoes/{id} (gestão, ORGANIZADOR) e /api/sessoes/minhas.
                        .requestMatchers(HttpMethod.GET, "/api/sessoes/*/mapa-assentos")
                        .permitAll()
                        // /api/ingressos/minhas e /api/ingressos/{codigo} têm a mesma forma de
                        // path (um segmento só) — ordem importa aqui: o matcher específico e
                        // autenticado de /minhas precisa vir ANTES do matcher genérico público de
                        // /*, senão o wildcard casa primeiro e vaza /minhas como rota pública
                        // (achado da Story 4.2, ver docs/decisions.md).
                        .requestMatchers(HttpMethod.GET, "/api/ingressos/minhas")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/ingressos/*")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new RestAuthenticationEntryPoint(objectMapper))
                        .accessDeniedHandler(new RestAccessDeniedHandler(objectMapper)))
                .addFilterBefore(new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsAllowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
