package br.com.zonasulurgente.api.media;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import app.photofox.vipsffm.VBlob;
import app.photofox.vipsffm.VImage;
import app.photofox.vipsffm.VTarget;
import app.photofox.vipsffm.Vips;
import app.photofox.vipsffm.VipsError;
import app.photofox.vipsffm.VipsOption;
import app.photofox.vipsffm.enums.VipsInteresting;
import app.photofox.vipsffm.enums.VipsSize;
import br.com.zonasulurgente.api.shared.web.ApiException;

/**
 * Gera os arquivos de uma foto com libvips (ARCHITECTURE §18): original sem metadados,
 * {largura}.avif e {largura}.webp em 400/800/1200 px (sem ampliar) e og.jpg 1200×630 para
 * redes sociais e WhatsApp. Respeita a orientação da câmera e remove EXIF/GPS de tudo.
 */
@Component
class ImageProcessor {

	static final int[] WIDTHS = { 400, 800, 1200 };

	/** keep=none: nenhum metadado (EXIF com GPS, XMP, IPTC) nos arquivos públicos. */
	private static final VipsOption KEEP_NONE = VipsOption.Int("keep", 0);

	record File(String name, String contentType, byte[] content) {
	}

	record Result(List<File> files, List<Integer> widths, int width, int height) {
	}

	private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ImageProcessor.class);

	private final MediaProperties props;
	private final Semaphore slots;

	ImageProcessor(MediaProperties props) {
		this.props = props;
		this.slots = new Semaphore(Math.max(1, props.maxConcurrent()));
	}

	Result process(byte[] bytes, ImageType type) {
		try {
			slots.acquire();
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw unavailable();
		}
		try {
			return run(bytes, type);
		}
		catch (VipsError e) {
			log.warn("libvips recusou a foto ({}, {} bytes): {}", type, bytes.length, e.getMessage());
			throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Foto inválida",
					"Não conseguimos ler essa foto. Tente outro arquivo (JPEG, PNG, WebP ou HEIC).");
		}
		catch (UnsatisfiedLinkError | ExceptionInInitializerError | NoClassDefFoundError e) {
			throw unavailable();
		}
		finally {
			slots.release();
		}
	}

	private Result run(byte[] bytes, ImageType type) {
		List<File> files = new ArrayList<>();
		List<Integer> widths = new ArrayList<>();
		int[] size = new int[2];
		Vips.run(arena -> {
			// Só o cabeçalho: barra fotos gigantes antes de decodificar (bomba de descompressão).
			VImage header = VImage.newFromBytes(arena, bytes);
			if ((long) header.getWidth() * header.getHeight() > props.maxPixels()) {
				throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Foto grande demais",
						"A foto tem resolução acima do limite. Reduza para no máximo 100 megapixels.");
			}

			VImage upright = header.autorot();
			int originalWidth = upright.getWidth();
			files.add(encode(arena, upright, "original." + type.originalExtension, originalOptions(type)));

			VBlob blob = VBlob.newFromBytes(arena, bytes);
			for (int target : targetWidths(originalWidth)) {
				// Altura livre: limita só a largura e nunca amplia.
				// copyMemory: a redução lê o JPEG em sequência; sem isso a segunda gravação (WebP
				// depois do AVIF) tentaria reler do início ("out of order read").
				VImage resized = VImage.thumbnailBuffer(arena, blob, target, VipsOption.Int("height", 100_000),
						VipsOption.Enum("size", VipsSize.SIZE_DOWN)).copyMemory();
				files.add(encode(arena, resized, target + ".avif", ".avif", VipsOption.Int("Q", 55),
						VipsOption.Int("effort", 2)));
				files.add(encode(arena, resized, target + ".webp", ".webp", VipsOption.Int("Q", 80)));
				widths.add(target);
				size[0] = resized.getWidth();
				size[1] = resized.getHeight();
			}

			// Compartilhamento: recorte 1200×630 na região mais "interessante" da foto.
			VImage og = VImage.thumbnailBuffer(arena, blob, 1200, VipsOption.Int("height", 630),
					VipsOption.Enum("crop", VipsInteresting.INTERESTING_ATTENTION));
			files.add(encode(arena, og, "og.jpg", ".jpg", VipsOption.Int("Q", 82)));
		});
		return new Result(files, widths, size[0], size[1]);
	}

	/** 400/800/1200 menores que a foto + a própria largura (até 1200): 900 px vira 400, 800, 900. */
	static List<Integer> targetWidths(int originalWidth) {
		List<Integer> targets = new ArrayList<>();
		for (int width : WIDTHS) {
			if (width < originalWidth) {
				targets.add(width);
			}
		}
		int largest = Math.min(WIDTHS[WIDTHS.length - 1], originalWidth);
		if (targets.isEmpty() || targets.getLast() != largest) {
			targets.add(largest);
		}
		return targets;
	}

	private static Object[] originalOptions(ImageType type) {
		return switch (type.originalExtension) {
			case "png" -> new Object[] { ".png" };
			case "webp" -> new Object[] { ".webp", VipsOption.Int("Q", 92) };
			default -> new Object[] { ".jpg", VipsOption.Int("Q", 92) };
		};
	}

	private static File encode(java.lang.foreign.Arena arena, VImage image, String name, Object[] suffixAndOptions) {
		VipsOption[] options = new VipsOption[suffixAndOptions.length - 1];
		for (int i = 1; i < suffixAndOptions.length; i++) {
			options[i - 1] = (VipsOption) suffixAndOptions[i];
		}
		return encode(arena, image, name, (String) suffixAndOptions[0], options);
	}

	private static File encode(java.lang.foreign.Arena arena, VImage image, String name, String suffix,
			VipsOption... options) {
		VipsOption[] all = new VipsOption[options.length + 1];
		System.arraycopy(options, 0, all, 0, options.length);
		all[options.length] = KEEP_NONE;
		VTarget target = VTarget.newToMemory(arena);
		image.writeToTarget(target, suffix, all);
		return new File(name, contentType(suffix), target.getBlob().getBytes());
	}

	private static String contentType(String suffix) {
		return switch (suffix) {
			case ".avif" -> "image/avif";
			case ".webp" -> "image/webp";
			case ".png" -> "image/png";
			default -> "image/jpeg";
		};
	}

	private static ApiException unavailable() {
		return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Envio de fotos indisponível",
				"O processamento de fotos não está disponível no servidor agora. Tente de novo em instantes.");
	}

}
