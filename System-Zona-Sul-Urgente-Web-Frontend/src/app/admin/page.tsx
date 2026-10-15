import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CameraIcon,
  EyeIcon,
  FilePenIcon,
  MegaphoneIcon,
  NewspaperIcon,
  SearchCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InstagramStatusBadge } from "@/components/admin/instagram-status-badge";
import { Panel, PanelEmpty } from "@/components/admin/panel";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { RelativeTime } from "@/components/news/relative-time";
import { adminRoutes } from "@/config/admin-navigation";
import { routes } from "@/config/navigation";
import {
  getCurrentUser,
  getDashboardStats,
  getInstagramQueue,
  getRecentlyUpdated,
} from "@/services/admin/admin-service";
import { getMostRead } from "@/services/news-service";

export const metadata: Metadata = { title: "Dashboard" };

// Dashboard do painel (FE-152), com dados de exemplo.
export default async function AdminDashboardPage() {
  const [user, stats, queue, recent, mostRead] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(),
    getInstagramQueue(5),
    getRecentlyUpdated(6),
    getMostRead("24h", 5),
  ]);
  const firstName = user.name.split(" ")[0];
  const trend = stats.viewsTrendPercent;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Olá, {firstName}</h1>
        <p className="text-sm text-muted-foreground">Resumo da redação hoje.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Publicadas hoje"
          value={stats.publishedToday}
          icon={<NewspaperIcon className="size-4" />}
          href={`${adminRoutes.news}?status=PUBLISHED`}
        />
        <StatCard
          label="Rascunhos"
          value={stats.drafts}
          icon={<FilePenIcon className="size-4" />}
          href={`${adminRoutes.news}?status=DRAFT`}
        />
        <StatCard
          label="Aguardando revisão"
          value={stats.inReview}
          icon={<SearchCheckIcon className="size-4" />}
          href={`${adminRoutes.news}?status=IN_REVIEW`}
          tone={stats.inReview > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Agendadas"
          value={stats.scheduled}
          icon={<CalendarClockIcon className="size-4" />}
          href={`${adminRoutes.news}?status=SCHEDULED`}
        />
        <StatCard
          label="Posts novos do Instagram"
          value={stats.instagramNew}
          icon={<CameraIcon className="size-4" />}
          href={adminRoutes.instagram}
        />
        <StatCard
          label="Erros de importação"
          value={stats.importErrors}
          icon={<AlertTriangleIcon className="size-4" />}
          href={adminRoutes.instagram}
          tone={stats.importErrors > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Campanhas ativas"
          value={stats.activeCampaigns}
          icon={<MegaphoneIcon className="size-4" />}
          href={adminRoutes.ads}
        />
        <StatCard
          label="Visualizações hoje"
          value={stats.viewsToday}
          icon={<EyeIcon className="size-4" />}
          href={adminRoutes.analytics}
          hint={
            <span className={trend >= 0 ? "text-emerald-700" : "text-red-700"}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% em relação a ontem
            </span>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Fila do Instagram"
          action={{ label: "Ver todos", href: adminRoutes.instagram }}
        >
          {queue.length === 0 ? (
            <PanelEmpty>Nenhum post esperando revisão.</PanelEmpty>
          ) : (
            <ul className="divide-y">
              {queue.map((post) => {
                return (
                  <li key={post.id} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <InstagramStatusBadge status={post.status} />
                      <RelativeTime iso={post.postedAt} className="text-xs text-muted-foreground" />
                    </div>
                    <p className="line-clamp-2 text-sm">{post.caption}</p>
                    {post.error && <p className="text-xs text-red-700">{post.error}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Últimas atualizações"
          action={{ label: "Todas as notícias", href: adminRoutes.news }}
        >
          {recent.length === 0 ? (
            <PanelEmpty>Nenhuma notícia ainda.</PanelEmpty>
          ) : (
            <ul className="divide-y">
              {recent.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 px-4 py-3">
                  <Link
                    href={adminRoutes.editNews(row.id)}
                    className="line-clamp-2 text-sm font-semibold hover:text-brand-blue hover:underline"
                  >
                    {row.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={row.status} />
                    <span>{row.authors.join(", ")}</span>
                    <span aria-hidden>·</span>
                    <RelativeTime iso={row.updatedAt} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Mais lidas hoje" action={{ label: "Analytics", href: adminRoutes.analytics }}>
          {mostRead.length === 0 ? (
            <PanelEmpty>Sem leituras registradas hoje.</PanelEmpty>
          ) : (
            <ol className="divide-y">
              {mostRead.map((news, index) => (
                <li key={news.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-5 font-heading text-lg leading-none font-bold text-brand-red tabular-nums">
                    {index + 1}
                  </span>
                  <Link
                    href={routes.news(news)}
                    target="_blank"
                    className="line-clamp-2 text-sm font-medium hover:text-brand-blue hover:underline"
                  >
                    {news.title}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
