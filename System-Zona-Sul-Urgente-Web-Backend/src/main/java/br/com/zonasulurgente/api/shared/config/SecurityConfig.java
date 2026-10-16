package br.com.zonasulurgente.api.shared.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

import br.com.zonasulurgente.api.shared.web.ProblemResponses;

/**
 * Política base: API pública só leitura, admin fechado até a autenticação
 * (e-mail + senha + TOTP) ser implementada. Tudo que não estiver listado é negado.
 */
@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
			.authorizeHttpRequests(auth -> auth
				.requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
				.requestMatchers("/api/v1/openapi/**", "/api/v1/docs", "/api/v1/swagger-ui/**").permitAll()
				.requestMatchers(HttpMethod.GET, "/api/v1/public/**").permitAll()
				.requestMatchers("/api/v1/admin/**").authenticated()
				.anyRequest().denyAll())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			// Erros de acesso também em problem+json (BE-002). Sem login no admin: 401;
			// o resto que a política nega (rota desconhecida, escrita na API pública): 403.
			.exceptionHandling(ex -> ex
				.authenticationEntryPoint((request, response, e) -> {
					if (request.getRequestURI().startsWith("/api/v1/admin/")) {
						ProblemResponses.write(response, 401, "Autenticação necessária",
								"Entre no painel para continuar.");
					}
					else {
						ProblemResponses.write(response, 403, "Acesso negado",
								"Este endereço não está disponível.");
					}
				})
				.accessDeniedHandler((request, response, e) -> ProblemResponses.write(response, 403,
						"Acesso negado", "Seu perfil não tem permissão para esta ação.")))
			.httpBasic(basic -> basic.disable())
			.formLogin(form -> form.disable())
			.headers(Customizer.withDefaults());
		return http.build();
	}

}
