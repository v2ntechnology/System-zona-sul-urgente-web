package br.com.zonasulurgente.api.shared.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

import br.com.zonasulurgente.api.auth.api.SessionAuthenticationFilter;
import br.com.zonasulurgente.api.auth.application.AuthService;

import br.com.zonasulurgente.api.shared.web.ProblemResponses;

/**
 * Política base: API pública só leitura; admin exige a sessão do painel (BE-006), e cada ação
 * confere a permissão com @PreAuthorize (BE-007). Tudo que não estiver listado é negado.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AuthService authService) throws Exception {
		http
			// A API não lê cookies (o Next repassa a sessão como Bearer): sem CSRF aqui.
			// O CSRF do navegador é barrado no Next (SameSite=Lax + Origin das Server Actions).
			.csrf(csrf -> csrf.disable())
			.addFilterBefore(new SessionAuthenticationFilter(authService), AnonymousAuthenticationFilter.class)
			.authorizeHttpRequests(auth -> auth
				.requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
				.requestMatchers("/api/v1/openapi/**", "/api/v1/docs", "/api/v1/swagger-ui/**").permitAll()
				.requestMatchers(HttpMethod.GET, "/api/v1/public/**").permitAll()
				// Fotos guardadas na pasta local (desenvolvimento; em produção vêm do R2).
				.requestMatchers(HttpMethod.GET, "/media/**").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/v1/admin/auth/login", "/api/v1/admin/auth/mfa").permitAll()
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
