import { RemoteImage } from "@/components/media/remote-image";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";
import { getAdForSlot } from "@/services/ad-service";
import type { AdSize, AdSlotKey } from "@/types/news";

// Espaço publicitário único (FE-109). Reserva a altura do formato antes do anúncio
// carregar (sem CLS). Sem anúncio: placeholder em desenvolvimento, nada em produção
// (a menos que NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS=true, útil para homologação).
const showPlaceholders =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS === "true";

type AdSlotProps = {
  slotKey: AdSlotKey;
  className?: string;
  /** Envolve no <Container>: quando não há anúncio, nem a margem do bloco aparece. */
  contained?: boolean;
};

/** O slot vai aparecer? Útil para a página decidir o layout (ex.: coluna lateral só com anúncio). */
export async function isAdSlotVisible(key: AdSlotKey): Promise<boolean> {
  return showPlaceholders || Boolean((await getAdForSlot(key)).ad);
}

export async function AdSlot({ slotKey, className, contained }: AdSlotProps) {
  const { slot, ad } = await getAdForSlot(slotKey);
  if (!ad && !showPlaceholders) return null;

  const desktop = slot.sizes[0];
  // No celular, o formato mais baixo entre os que cabem em 360px (ex.: 300×250, não 300×600);
  // se nenhum couber, o mais estreito.
  const fitting = slot.sizes.filter((size) => size.width <= 360);
  const mobile =
    fitting.length > 0
      ? fitting.reduce((a, b) => (b.height < a.height ? b : a))
      : slot.sizes.reduce((a, b) => (b.width < a.width ? b : a));

  const slotElement = (
    <aside aria-label="Publicidade" className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-[0.625rem] tracking-widest text-muted-foreground uppercase">
        Publicidade
      </span>
      <div
        style={sizeVars(mobile, desktop)}
        className="flex min-h-(--ad-h-m) w-full max-w-(--ad-w-m) items-center justify-center overflow-hidden bg-ad-slot md:min-h-(--ad-h-d) md:max-w-(--ad-w-d)"
      >
        {ad?.type === "DIRECT" ? (
          <a
            href={ad.clickUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="block"
          >
            <RemoteImage
              src={ad.image.url}
              alt={ad.image.alt}
              width={ad.image.width}
              height={ad.image.height}
              sizes={`${desktop.width}px`}
            />
          </a>
        ) : ad?.type === "ADSENSE" ? (
          // Integração AdSense entra com o consentimento de cookies (ARCHITECTURE §16).
          <div data-ad-unit={ad.adUnitId} className="size-full" />
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">
            {slot.label} · {desktop.width}×{desktop.height}
          </span>
        )}
      </div>
    </aside>
  );

  return contained ? <Container>{slotElement}</Container> : slotElement;
}

function sizeVars(mobile: AdSize, desktop: AdSize): React.CSSProperties {
  return {
    "--ad-w-m": `${mobile.width}px`,
    "--ad-h-m": `${mobile.height}px`,
    "--ad-w-d": `${desktop.width}px`,
    "--ad-h-d": `${desktop.height}px`,
  } as React.CSSProperties;
}
