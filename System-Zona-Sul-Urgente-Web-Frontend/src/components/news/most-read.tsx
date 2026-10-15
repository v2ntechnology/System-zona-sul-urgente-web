import { MostReadTabs } from "@/components/news/most-read-tabs";
import { getMostRead } from "@/services/news-service";

// "Mais lidas" (FE-107): as três listas vêm do servidor; as abas só alternam no cliente.
export async function MostRead({ className }: { className?: string }) {
  const [day, week, all] = await Promise.all([
    getMostRead("24h", 5),
    getMostRead("7d", 5),
    getMostRead("all", 5),
  ]);
  return <MostReadTabs lists={{ day, week, all }} className={className} />;
}
