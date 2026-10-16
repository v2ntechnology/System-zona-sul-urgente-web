package br.com.zonasulurgente.api.jobs;

import tools.jackson.databind.JsonNode;

/**
 * Executa um tipo de job da fila. Lançar exceção = falha: o job volta para a fila com espera
 * crescente e vira DEAD depois de {@code max_attempts} tentativas. Precisa ser idempotente
 * (o mesmo job pode rodar de novo se o worker cair no meio).
 */
public interface JobHandler {

	String type();

	void handle(JsonNode payload) throws Exception;

}
