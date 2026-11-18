"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";
import { useState } from "react";

import { isOptimizedImage } from "@/lib/image-hosts";
import { mediaVariantUrl, parseOwnMedia } from "@/lib/media-url";
import { isPortrait } from "@/lib/portrait";
import { cn } from "@/lib/utils";

// Fotos enviadas pelo painel já têm as larguras prontas (BE-012): o loader só escolhe o arquivo.
const mediaLoader: ImageLoader = ({ src, width }) => mediaVariantUrl(src, width);

type Props = ImageProps & {
  src: string;
  /**
   * Moldura para foto vertical num quadro horizontal (capa de Reels, foto de celular): em vez de cortar o meio e
   * ampliar (fica borrada), mostra a foto inteira com o fundo da própria foto desfocado nas laterais. `true` descobre
   * a orientação ao carregar; passar as dimensões evita a troca visual quando já se sabe (MediaAsset).
   */
  frame?: boolean | { width: number; height: number };
};

/**
 * `next/image` para fotos que vêm dos dados (notícias, anúncios, Instagram). Fotos enviadas pelo
 * painel usam as versões geradas pela API; outros endereços fora de `OPTIMIZED_IMAGE_PATTERNS`
 * são exibidos sem otimização em vez de quebrar a página.
 */
export function RemoteImage({ frame, ...props }: Props) {
  const known = typeof frame === "object" ? isPortrait(frame.width, frame.height) : null;
  const [detected, setDetected] = useState<boolean | null>(null);
  const portrait = known ?? detected ?? false;

  if (!frame || !props.fill) return <BaseImage {...props} />;

  return (
    <>
      {portrait && (
        <BaseImage
          {...props}
          alt=""
          aria-hidden
          preload={false}
          loading="lazy"
          sizes="64px"
          className="scale-110 object-cover opacity-80 blur-xl"
        />
      )}
      <BaseImage
        {...props}
        className={cn(props.className, portrait && "object-contain")}
        onLoad={(event) => {
          if (known === null) {
            const img = event.currentTarget;
            setDetected(isPortrait(img.naturalWidth, img.naturalHeight));
          }
          props.onLoad?.(event);
        }}
      />
    </>
  );
}

function BaseImage({ src, alt, unoptimized, ...props }: ImageProps & { src: string }) {
  if (parseOwnMedia(src)) {
    return <Image src={src} alt={alt} loader={mediaLoader} {...props} />;
  }
  return (
    <Image src={src} alt={alt} unoptimized={unoptimized || !isOptimizedImage(src)} {...props} />
  );
}
