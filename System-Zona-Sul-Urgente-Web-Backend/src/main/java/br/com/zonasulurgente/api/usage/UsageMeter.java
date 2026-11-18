package br.com.zonasulurgente.api.usage;

import java.util.Map;
import java.util.Set;

import br.com.zonasulurgente.api.usage.UsageProperties.Meter;

/** Fonte de números de uso (nuvem, disco). Uma leitura pode trazer vários medidores de uma vez. */
interface UsageMeter {

	/** {@code limit} preenchido quando o próprio medidor sabe o limite (ex.: tamanho do disco). */
	record Reading(long value, Long limit) {
	}

	Set<Meter> meters();

	/** Lê agora. Exceção = leitura falhou (a tela mostra o último valor e "desatualizado"). */
	Map<Meter, Reading> read() throws Exception;

}
