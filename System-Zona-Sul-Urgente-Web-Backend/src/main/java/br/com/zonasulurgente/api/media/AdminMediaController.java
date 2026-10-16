package br.com.zonasulurgente.api.media;

import java.io.IOException;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;

/** Envio de fotos pelo editor (BE-012). Quem cria notícia pode enviar a foto dela. */
@RestController
@RequestMapping("/api/v1/admin/media")
class AdminMediaController {

	private final MediaService media;

	AdminMediaController(MediaService media) {
		this.media = media;
	}

	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@PreAuthorize("hasAuthority('news.create')")
	MediaService.Uploaded upload(@RequestParam("file") MultipartFile file,
			@AuthenticationPrincipal AuthenticatedUser user) throws IOException {
		return media.upload(file.getBytes(), user);
	}

}
