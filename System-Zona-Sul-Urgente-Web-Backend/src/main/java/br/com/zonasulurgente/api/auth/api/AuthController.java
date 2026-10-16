package br.com.zonasulurgente.api.auth.api;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.auth.application.AuthService;
import br.com.zonasulurgente.api.auth.application.AuthService.LoginResult;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Login do painel (BE-006). Chamado só pelo servidor do Next (BFF), nunca pelo navegador. */
@RestController
@RequestMapping("/api/v1/admin/auth")
@Tag(name = "Autenticação (admin)")
public class AuthController {

	public record LoginRequest(
			@NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.") @Size(max = 200) String email,
			@NotBlank(message = "Informe a senha.") @Size(max = 200, message = "Senha longa demais.") String password) {
	}

	public record CodeRequest(@NotBlank(message = "Desafio ausente.") @Size(max = 100) String challenge,
			@Pattern(regexp = "\\d{6}", message = "Digite os 6 números do app autenticador.") String code) {
	}

	@com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
	public record Me(UUID id, String name, String email, String role, List<String> permissions, String authorSlug) {
	}

	private final AuthService auth;

	public AuthController(AuthService auth) {
		this.auth = auth;
	}

	@PostMapping("/login")
	@Operation(summary = "1ª etapa: e-mail e senha → sessão, ou desafio do código (MFA)")
	public LoginResult login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
		return auth.login(body.email().strip(), body.password(), ClientInfo.ip(request), ClientInfo.userAgent(request));
	}

	@PostMapping("/mfa")
	@Operation(summary = "2ª etapa: código do app autenticador (também conclui o cadastro do app)")
	public LoginResult mfa(@Valid @RequestBody CodeRequest body, HttpServletRequest request) {
		return auth.verifyCode(body.challenge(), body.code(), ClientInfo.ip(request), ClientInfo.userAgent(request));
	}

	@PostMapping("/logout")
	@Operation(summary = "Encerra a sessão no banco (não só o cookie)")
	public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authorization) {
		auth.logout(authorization.substring("Bearer ".length()).trim());
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me")
	@Operation(summary = "Quem está logado e suas permissões")
	public Me me(@AuthenticationPrincipal AuthenticatedUser user) {
		return new Me(user.id(), user.name(), user.email(), user.role(), user.permissions(), user.authorSlug());
	}

}
