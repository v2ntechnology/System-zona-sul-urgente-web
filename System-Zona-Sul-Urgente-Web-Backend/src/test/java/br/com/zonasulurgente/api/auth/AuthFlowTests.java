package br.com.zonasulurgente.api.auth;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.auth.application.Totp;

/**
 * BE-006/BE-007 sobre a equipe de exemplo (perfil local; senha de desenvolvimento definida
 * pelo LocalDevUsers): login em duas etapas, sessão, bloqueio e permissões.
 */
@Import({ TestcontainersConfiguration.class, AuthFlowTests.ProtectedEndpoints.class })
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class AuthFlowTests {

	static final String PASSWORD = "zonasul-local";

	/** Rota de teste protegida por permissão, para provar o @PreAuthorize. */
	@TestConfiguration
	static class ProtectedEndpoints {

		@RestController
		static class PublishProbe {

			@GetMapping("/api/v1/admin/test/publish")
			@PreAuthorize("hasAuthority('news.publish')")
			String publish() {
				return "ok";
			}

		}

	}

	@Autowired
	MockMvc mvc;

	private String login(String email, String password) throws Exception {
		return mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
			.andReturn().getResponse().getContentAsString();
	}

	private String code(String challenge, String code) throws Exception {
		return mvc.perform(post("/api/v1/admin/auth/mfa").contentType(MediaType.APPLICATION_JSON)
				.content("{\"challenge\":\"" + challenge + "\",\"code\":\"" + code + "\"}"))
			.andReturn().getResponse().getContentAsString();
	}

	@Test
	void reporterWithout2faGetsSessionAndOwnPermissions() throws Exception {
		String body = login("ana.ribeiro@zonasulurgente.com.br", PASSWORD);
		String token = JsonPath.read(body, "$.session.token");
		mvc.perform(get("/api/v1/admin/auth/me").header("Authorization", "Bearer " + token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.role").value("REPORTER"))
			.andExpect(jsonPath("$.authorSlug").value("ana-ribeiro"))
			.andExpect(jsonPath("$.permissions", hasItem("news.create")))
			.andExpect(jsonPath("$.permissions", not(hasItem("news.publish"))));
		// RBAC: repórter não publica.
		mvc.perform(get("/api/v1/admin/test/publish").header("Authorization", "Bearer " + token))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminEnrolsAuthenticatorOnFirstLoginThenNeedsCodeEveryTime() throws Exception {
		String first = login("juliana.prado@zonasulurgente.com.br", PASSWORD);
		org.assertj.core.api.Assertions.assertThat((String) JsonPath.read(first, "$.status"))
			.isEqualTo("MFA_SETUP_REQUIRED");
		String secret = JsonPath.read(first, "$.totpSetup.secret");
		String challenge = JsonPath.read(first, "$.challenge");

		long step = Totp.step(Instant.now());
		org.assertj.core.api.Assertions.assertThat(code(challenge, "000000")).contains("Código incorreto");
		String done = code(challenge, Totp.code(secret, step));
		String token = JsonPath.read(done, "$.session.token");
		mvc.perform(get("/api/v1/admin/test/publish").header("Authorization", "Bearer " + token))
			.andExpect(status().isOk());

		// Próximo login: só o código (o mesmo código não serve de novo).
		String second = login("juliana.prado@zonasulurgente.com.br", PASSWORD);
		org.assertj.core.api.Assertions.assertThat((String) JsonPath.read(second, "$.status"))
			.isEqualTo("MFA_REQUIRED");
		String challenge2 = JsonPath.read(second, "$.challenge");
		org.assertj.core.api.Assertions.assertThat(code(challenge2, Totp.code(secret, step))).contains("Código incorreto");
		org.assertj.core.api.Assertions.assertThat(code(challenge2, Totp.code(secret, step + 1))).contains("AUTHENTICATED");
	}

	@Test
	void wrongPasswordIsGenericAndFiveFailuresLockTheAccount() throws Exception {
		for (int i = 0; i < 5; i++) {
			mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
					.content("{\"email\":\"carlos.menezes@zonasulurgente.com.br\",\"password\":\"errada\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.detail").value("E-mail ou senha incorretos."));
		}
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"carlos.menezes@zonasulurgente.com.br\",\"password\":\"" + PASSWORD + "\"}"))
			.andExpect(status().isTooManyRequests());
	}

	@Test
	void invitedOrUnknownAccountsCannotLogIn() throws Exception {
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"lucas.ferreira@zonasulurgente.com.br\",\"password\":\"" + PASSWORD + "\"}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"ninguem@x.com\",\"password\":\"" + PASSWORD + "\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.detail").value("E-mail ou senha incorretos."));
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"nao-e-email\",\"password\":\"\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void logoutKillsTheSessionInTheDatabase() throws Exception {
		String token = JsonPath.read(login("ana.ribeiro@zonasulurgente.com.br", PASSWORD), "$.session.token");
		mvc.perform(post("/api/v1/admin/auth/logout").header("Authorization", "Bearer " + token))
			.andExpect(status().isNoContent());
		mvc.perform(get("/api/v1/admin/auth/me").header("Authorization", "Bearer " + token))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/admin/auth/me").header("Authorization", "Bearer inventado"))
			.andExpect(status().isUnauthorized());
	}

}
