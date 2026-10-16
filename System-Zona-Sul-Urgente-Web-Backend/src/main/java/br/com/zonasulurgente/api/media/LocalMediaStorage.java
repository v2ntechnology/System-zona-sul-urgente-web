package br.com.zonasulurgente.api.media;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Desenvolvimento: grava em uma pasta servida pela API em /media/** (ver LocalMediaWebConfig). */
class LocalMediaStorage implements MediaStorage {

	private final Path root;

	LocalMediaStorage(Path root) {
		this.root = root.toAbsolutePath().normalize();
	}

	Path root() {
		return root;
	}

	@Override
	public void put(String key, byte[] content, String contentType) {
		Path file = root.resolve(key).normalize();
		if (!file.startsWith(root)) {
			throw new IllegalArgumentException("Chave fora da pasta de mídia: " + key);
		}
		try {
			Files.createDirectories(file.getParent());
			Files.write(file, content);
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

}
