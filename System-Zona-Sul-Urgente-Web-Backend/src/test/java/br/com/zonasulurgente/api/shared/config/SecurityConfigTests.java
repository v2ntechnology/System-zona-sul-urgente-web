package br.com.zonasulurgente.api.shared.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import br.com.zonasulurgente.api.TestcontainersConfiguration;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTests {

	@Autowired
	MockMvc mvc;

	@Test
	void healthIsPublic() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
	}

	@Test
	void adminRequiresAuthentication() throws Exception {
		mvc.perform(get("/api/v1/admin/news")).andExpect(status().isForbidden());
	}

	@Test
	void publicApiIsReadOnly() throws Exception {
		mvc.perform(post("/api/v1/public/news")).andExpect(status().isForbidden());
	}

	@Test
	void unknownRoutesAreDenied() throws Exception {
		mvc.perform(get("/qualquer-coisa")).andExpect(status().isForbidden());
	}

}
