package br.com.zonasulurgente.api.auth.api;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import br.com.zonasulurgente.api.auth.application.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Autentica /api/v1/admin/** pelo Bearer que o Next repassa (token da sessão opaca, lido do
 * cookie __Host-zsu_session no servidor do Next). As permissões da matriz viram authorities,
 * usadas em {@code @PreAuthorize("hasAuthority('news.publish')")}. A API não lê cookies.
 */
public class SessionAuthenticationFilter extends OncePerRequestFilter {

	private final AuthService auth;

	public SessionAuthenticationFilter(AuthService auth) {
		this.auth = auth;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !request.getRequestURI().startsWith("/api/v1/admin/");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String header = request.getHeader("Authorization");
		if (header != null && header.startsWith("Bearer ") && header.length() < 200) {
			auth.authenticate(header.substring(7).trim()).ifPresent(user -> {
				var authorities = user.permissions().stream().map(SimpleGrantedAuthority::new).toList();
				SecurityContextHolder.getContext()
					.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, authorities));
			});
		}
		chain.doFilter(request, response);
	}

}
