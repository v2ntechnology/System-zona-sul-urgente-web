package br.com.zonasulurgente.api.auth.application;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.auth.config.AuthProperties;

/**
 * Criptografa os segredos TOTP com AES-256-GCM (chave fora do banco: TOTP_ENCRYPTION_KEY).
 * Formato guardado: base64(iv[12] || texto cifrado + tag). Sem chave configurada, falha ao
 * usar (e não ao subir), para a API pública funcionar sem a configuração do admin.
 */
@Component
public class SecretCipher {

	private static final SecureRandom RANDOM = new SecureRandom();

	private final AuthProperties properties;

	public SecretCipher(AuthProperties properties) {
		this.properties = properties;
	}

	public String encrypt(String plain) {
		try {
			byte[] iv = new byte[12];
			RANDOM.nextBytes(iv);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, iv));
			byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
			return Base64.getEncoder()
				.encodeToString(ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array());
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("Falha ao criptografar o segredo.", ex);
		}
	}

	public String decrypt(String stored) {
		try {
			byte[] all = Base64.getDecoder().decode(stored);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, all, 0, 12));
			return new String(cipher.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("Falha ao abrir o segredo (chave trocada?).", ex);
		}
	}

	private SecretKeySpec key() {
		String encoded = properties.totpKey();
		if (encoded == null || encoded.isBlank()) {
			throw new IllegalStateException("Configure TOTP_ENCRYPTION_KEY (32 bytes em base64).");
		}
		byte[] key = Base64.getDecoder().decode(encoded);
		if (key.length != 32) {
			throw new IllegalStateException("TOTP_ENCRYPTION_KEY precisa ter 32 bytes (AES-256).");
		}
		return new SecretKeySpec(key, "AES");
	}

}
