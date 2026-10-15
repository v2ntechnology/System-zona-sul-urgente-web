import { PlayIcon } from "lucide-react";
import Image from "next/image";

import type { MediaAsset, VideoEmbed } from "@/types/news";

export function ArticleFigure({ image, preload }: { image: MediaAsset; preload?: boolean }) {
  const legend = [image.caption, image.credit].filter(Boolean).join(" · ");
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 760px, 100vw"
          preload={preload}
          className="object-cover"
        />
      </div>
      {legend && <figcaption className="text-sm text-muted-foreground">{legend}</figcaption>}
    </figure>
  );
}

// Vídeo: R2 em <video> nativo; YouTube via youtube-nocookie (menos rastreamento, LGPD);
// Instagram como link (o embed oficial carrega scripts e cookies de terceiros).
export function ArticleVideo({
  video,
  fallbackPoster,
}: {
  video: VideoEmbed;
  fallbackPoster?: MediaAsset;
}) {
  if (video.provider === "r2") {
    return (
      <video
        controls
        preload="metadata"
        poster={(video.poster ?? fallbackPoster)?.url}
        className="aspect-video w-full bg-black object-cover"
      >
        <source src={video.url} type="video/mp4" />
        Seu navegador não reproduz vídeos.
      </video>
    );
  }

  if (video.provider === "youtube") {
    const id = new URL(video.url).searchParams.get("v") ?? video.url.split("/").pop();
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="Vídeo da reportagem"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full"
      />
    );
  }

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 border bg-muted p-4 transition hover:border-brand-blue"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-red text-white transition-transform group-hover:scale-110">
        <PlayIcon className="size-5 fill-current" aria-hidden />
      </span>
      <span>
        <span className="block font-semibold">Assista ao vídeo no Instagram</span>
        <span className="text-sm text-muted-foreground">Abre em uma nova aba</span>
      </span>
    </a>
  );
}
