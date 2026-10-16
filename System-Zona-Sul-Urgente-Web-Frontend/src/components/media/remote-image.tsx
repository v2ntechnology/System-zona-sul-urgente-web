"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";

import { isOptimizedImage } from "@/lib/image-hosts";
import { mediaVariantUrl, parseOwnMedia } from "@/lib/media-url";

// Fotos enviadas pelo painel já têm as larguras prontas (BE-012): o loader só escolhe o arquivo.
const mediaLoader: ImageLoader = ({ src, width }) => mediaVariantUrl(src, width);

/**
 * `next/image` para fotos que vêm dos dados (notícias, anúncios, Instagram). Fotos enviadas pelo
 * painel usam as versões geradas pela API; outros endereços fora de `OPTIMIZED_IMAGE_PATTERNS`
 * são exibidos sem otimização em vez de quebrar a página.
 */
export function RemoteImage({ src, alt, unoptimized, ...props }: ImageProps & { src: string }) {
  if (parseOwnMedia(src)) {
    return <Image src={src} alt={alt} loader={mediaLoader} {...props} />;
  }
  return (
    <Image src={src} alt={alt} unoptimized={unoptimized || !isOptimizedImage(src)} {...props} />
  );
}
