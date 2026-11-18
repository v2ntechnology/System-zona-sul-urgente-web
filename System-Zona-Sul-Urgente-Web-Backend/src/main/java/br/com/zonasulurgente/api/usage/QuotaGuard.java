package br.com.zonasulurgente.api.usage;

/**
 * Porta do monitor de uso para os outros módulos (spec 004). Quem gasta um recurso de plano grátis pergunta antes
 * ({@link #check}) e conta depois ({@link #record}). Recurso que não está configurado passa direto.
 */
public interface QuotaGuard {

	/**
	 * Pode gastar {@code amount} de {@code resource}? Passa em silêncio; acima da trava lança
	 * {@link QuotaBlockedException} (espaço/gravações: recusar) ou {@link QuotaDeferredException} (janela que zera
	 * logo: esperar).
	 */
	void check(String resource, long amount);

	/** Conta o que foi gasto de fato (atualiza o nível e a trava se mudarem). */
	void record(String resource, long amount);

}
