import { adSlots, adsMock } from "@/mocks/ads";
import type { AdSlot, AdSlotKey, Advertisement } from "@/types/news";

// Publicidade (FE-010/FE-109). Slot sem anúncio devolve `ad: undefined`: o <AdSlot />
// mostra o placeholder em desenvolvimento e mantém o espaço reservado (sem CLS).

export async function getAdForSlot(key: AdSlotKey): Promise<{ slot: AdSlot; ad?: Advertisement }> {
  return { slot: adSlots[key], ad: adsMock.find((ad) => ad.slot === key) };
}
