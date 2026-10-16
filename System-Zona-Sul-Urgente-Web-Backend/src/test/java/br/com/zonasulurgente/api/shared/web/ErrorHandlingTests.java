package br.com.zonasulurgente.api.shared.web;

import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** BE-002: problem+json em português e correlation ID. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ErrorHandlingTests {

	@Autowired
	MockMvc mvc;

	@Test
	void unknownPublicRouteIsProblemJson404() throws Exception {
		mvc.perform(get("/api/v1/public/nao-existe").header(RequestIdFilter.HEADER, "teste-12345"))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.title").value("Não encontrado"))
			.andExpect(jsonPath("$.requestId").value("teste-12345"))
			.andExpect(jsonPath("$.trace").doesNotExist());
	}

	@Test
	void echoesSafeRequestIdAndReplacesUnsafeOne() throws Exception {
		mvc.perform(get("/actuator/health").header(RequestIdFilter.HEADER, "abc-123-def"))
			.andExpect(header().string(RequestIdFilter.HEADER, "abc-123-def"));
		mvc.perform(get("/actuator/health").header(RequestIdFilter.HEADER, "x\ninjetado"))
			.andExpect(header().string(RequestIdFilter.HEADER, not("x\ninjetado")))
			.andExpect(header().string(RequestIdFilter.HEADER, matchesPattern("[0-9a-f-]{36}")));
	}

}
