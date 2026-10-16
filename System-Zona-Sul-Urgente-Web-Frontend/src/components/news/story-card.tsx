import { RemoteImage } from "@/components/media/remote-image";

import { routes } from "@/config/navigation";
import { sectionStyle } from "@/lib/section-color";
import { cn } from "@/lib/utils";
import type { WebStory } from "@/types/news";

// Card vertical de Web Story (estilo CNN). Link com <a>: a story é uma página AMP fora do app.
export function StoryCard({ story, className }: { story: WebStory; className?: string }) {
  return (
    <article className={cn("group relative w-44 shrink-0 snap-start sm:w-52", className)}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-brand-blue-dark">
        <RemoteImage
          src={story.cover.url}
          alt={story.cover.alt}
          fill
          sizes="208px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />
        {/* Indicador de "várias telas", como nos stories. */}
        <div aria-hidden className="absolute inset-x-3 top-3 flex gap-1">
          {story.pages.slice(0, 5).map((page, i) => (
            <span key={i} className="h-0.5 flex-1 rounded-full bg-white/70" />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
          <span
            style={sectionStyle(story.category)}
            className="self-start bg-[color:var(--section)] px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide text-white uppercase"
          >
            {story.category.name}
          </span>
          <h3 className="font-heading text-teaser font-bold text-white">
            <a
              href={routes.story(story.slug)}
              data-story-url={routes.story(story.slug)}
              className="group-hover:underline after:absolute after:inset-0"
            >
              {story.title}
            </a>
          </h3>
        </div>
      </div>
    </article>
  );
}
