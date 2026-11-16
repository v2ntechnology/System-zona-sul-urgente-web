package br.com.zonasulurgente.api.instagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import br.com.zonasulurgente.api.instagram.InstagramGraphClient.AccessRevokedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.GraphRejectedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.Media;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.TransientGraphException;
import tools.jackson.databind.json.JsonMapper;

/** BE-013 (spec 001): cliente da API da Meta contra um servidor local — leitura, paginação e erros. */
class InstagramGraphClientTests {

	private static final OffsetDateTime NOW = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);

	private FakeGraphServer meta;
	private InstagramGraphClient client;

	@BeforeEach
	void start() {
		meta = new FakeGraphServer();
		client = new InstagramGraphClient(new InstagramProperties(meta.baseUrl(), Duration.ofMinutes(15),
				Duration.ofDays(7), Duration.ofDays(30), 3, Duration.ofSeconds(5)), JsonMapper.builder().build());
	}

	@AfterEach
	void stop() {
		meta.stop();
	}

	@Test
	void readsTheAccountWithTheTokenOnlyInTheHeader() {
		var account = client.account(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN);

		assertThat(account.username()).isEqualTo(FakeGraphServer.USERNAME);
		assertThat(meta.authorizations()).containsOnly("Bearer " + FakeGraphServer.TOKEN);
		assertThat(meta.paths()).noneMatch(p -> p.contains(FakeGraphServer.TOKEN));
	}

	@Test
	void readsPhotoReelAndCarouselFields() {
		meta.photo("1", "Foto com legenda #copacabana", NOW.minusHours(1));
		meta.reel("2", "Reel sem arquivo", NOW.minusHours(2), false, true);
		meta.carousel("3", "Carrossel", NOW.minusHours(3), List.of("IMAGE", "VIDEO"));

		List<Media> items = client.media(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN, null).items();

		assertThat(items).extracting(Media::id).containsExactly("1", "2", "3");
		Media photo = items.get(0);
		assertThat(photo.caption()).isEqualTo("Foto com legenda #copacabana");
		assertThat(photo.mediaUrl()).endsWith("/img/1.jpg");
		assertThat(photo.altText()).isEqualTo("Descrição da foto 1");
		assertThat(photo.permalink()).isEqualTo(FakeGraphServer.permalink("1"));
		assertThat(photo.timestamp()).isEqualTo(NOW.minusHours(1));
		Media reel = items.get(1);
		assertThat(reel.mediaProductType()).isEqualTo("REELS");
		assertThat(reel.mediaUrl()).isNull();
		assertThat(reel.thumbnailUrl()).endsWith("/img/2-capa.jpg");
		Media carousel = items.get(2);
		assertThat(carousel.children()).hasSize(2);
		assertThat(carousel.children().get(1).thumbnailUrl()).endsWith("/img/3-1-capa.jpg");
	}

	@Test
	void followsTheCursorUntilTheLastPage() {
		for (int i = 0; i < 30; i++) {
			meta.photo("p" + i, "Post " + i, NOW.minusMinutes(i));
		}

		List<String> ids = new ArrayList<>();
		String after = null;
		int pages = 0;
		do {
			var page = client.media(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN, after);
			page.items().forEach(m -> ids.add(m.id()));
			after = page.after();
			pages++;
		}
		while (after != null);

		assertThat(pages).isEqualTo(2);
		assertThat(ids).hasSize(30).doesNotHaveDuplicates();
	}

	@Test
	void deletedPostIsEmptyAndExistingOneIsFound() {
		meta.photo("1", "Existe", NOW);

		assertThat(client.mediaById("1", FakeGraphServer.TOKEN)).isPresent();
		assertThat(client.mediaById("999", FakeGraphServer.TOKEN)).isEmpty();
	}

	@Test
	void classifiesGraphErrors() {
		assertThatThrownBy(() -> client.account(FakeGraphServer.ACCOUNT_ID, "outro-token"))
			.isInstanceOf(AccessRevokedException.class)
			.hasMessageNotContaining("outro-token");

		meta.failWith(400, 190);
		assertThatThrownBy(() -> client.account(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN))
			.isInstanceOf(AccessRevokedException.class);
		for (int code : new int[] { 4, 17, 32, 613 }) {
			meta.failWith(400, code);
			assertThatThrownBy(() -> client.account(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN))
				.isInstanceOf(TransientGraphException.class);
		}
		meta.failWith(500, 0);
		assertThatThrownBy(() -> client.account(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN))
			.isInstanceOf(TransientGraphException.class);
		meta.failWith(400, 100);
		assertThatThrownBy(() -> client.account(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN))
			.isInstanceOf(GraphRejectedException.class);
	}

	@Test
	void unreachableMetaIsTransient() {
		meta.stop();
		assertThatThrownBy(() -> client.account(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN))
			.isInstanceOf(TransientGraphException.class);
		meta = new FakeGraphServer();
	}

	@Test
	void downloadsImages() {
		meta.photo("1", "Foto", NOW);
		String url = client.media(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN, null).items().getFirst().mediaUrl();

		byte[] bytes = client.download(url);

		assertThat(bytes).hasSizeGreaterThan(100);
		assertThat(bytes[0]).isEqualTo((byte) 0xFF);
		assertThat(bytes[1]).isEqualTo((byte) 0xD8);
	}

	@Test
	void parsesMetaTimestamps() {
		assertThat(InstagramGraphClient.time("2026-11-16T17:11:22+0000"))
			.isEqualTo(OffsetDateTime.of(2026, 11, 16, 17, 11, 22, 0, ZoneOffset.UTC));
		assertThat(InstagramGraphClient.time("2026-11-16T17:11:22Z"))
			.isEqualTo(OffsetDateTime.of(2026, 11, 16, 17, 11, 22, 0, ZoneOffset.UTC));
	}

}
