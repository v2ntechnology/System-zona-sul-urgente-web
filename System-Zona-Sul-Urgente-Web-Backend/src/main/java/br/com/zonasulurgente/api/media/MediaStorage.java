package br.com.zonasulurgente.api.media;

/** Onde os arquivos das fotos ficam (R2 em produção, pasta local em desenvolvimento). */
public interface MediaStorage {

	/** Cache longo e imutável: cada arquivo tem chave única e nunca é sobrescrito. */
	String CACHE_CONTROL = "public, max-age=31536000, immutable";

	void put(String key, byte[] content, String contentType);

}
