import Image, { type ImageProps } from "next/image";

import { isOptimizedImage } from "@/lib/image-hosts";

/**
 * `next/image` para fotos que vêm dos dados (notícias, anúncios, Instagram): endereços
 * fora de `OPTIMIZED_IMAGE_PATTERNS` são exibidos sem otimização em vez de quebrar a página.
 */
export function RemoteImage({ src, alt, unoptimized, ...props }: ImageProps & { src: string }) {
  return (
    <Image src={src} alt={alt} unoptimized={unoptimized || !isOptimizedImage(src)} {...props} />
  );
}
