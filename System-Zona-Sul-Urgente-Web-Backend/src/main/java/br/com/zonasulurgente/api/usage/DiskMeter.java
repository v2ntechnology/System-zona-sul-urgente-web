package br.com.zonasulurgente.api.usage;

import java.io.IOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.usage.UsageProperties.Meter;

/**
 * Disco do servidor (FR-011): dentro do contêiner, a raiz mostra o disco do servidor (o Docker grava nele). Só aviso,
 * nunca trava.
 */
@Component
class DiskMeter implements UsageMeter {

	@Override
	public Set<Meter> meters() {
		return Set.of(Meter.DISK);
	}

	@Override
	public Map<Meter, Reading> read() throws IOException {
		FileStore store = Files.getFileStore(Path.of("/"));
		long total = store.getTotalSpace();
		return Map.of(Meter.DISK, new Reading(total - store.getUsableSpace(), total));
	}

}
