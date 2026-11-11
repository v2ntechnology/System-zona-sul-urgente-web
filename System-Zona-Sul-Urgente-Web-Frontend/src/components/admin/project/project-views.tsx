import { CheckCircle2Icon, CircleDotIcon, CircleIcon, EyeIcon } from "lucide-react";
import Link from "next/link";

import { Panel, PanelEmpty } from "@/components/admin/panel";
import { cn } from "@/lib/utils";
import {
  type BacklogItem,
  GROUPS,
  type ItemStatus,
  progressOf,
  STATUS_LABELS,
} from "@/lib/project/backlog";
import { type Commit, groupByDay, KIND_LABELS } from "@/lib/project/history";

// Telas do painel do projeto (inspirado no painel do onPath): visão geral, board, histórico.

const statusStyle: Record<ItemStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  doing: "bg-amber-50 text-amber-900",
  review: "bg-brand-sky-light text-brand-blue",
  done: "bg-emerald-50 text-emerald-800",
};

const statusIcon: Record<ItemStatus, typeof CircleIcon> = {
  todo: CircleIcon,
  doing: CircleDotIcon,
  review: EyeIcon,
  done: CheckCircle2Icon,
};

/** Barra empilhada: feito (azul) + em revisão (azul-claro: pronto, aguardando aprovação). */
function ProgressBar({
  done,
  review = 0,
  total,
  label,
}: {
  done: number;
  review?: number;
  total: number;
  label: string;
}) {
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} feitos e ${review} em revisão de ${total}`}
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full bg-primary" style={{ width: `${pct(done)}%` }} />
      <div className="h-full bg-brand-sky" style={{ width: `${pct(review)}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const Icon = statusIcon[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        statusStyle[status],
      )}
    >
      <Icon aria-hidden className="size-3" /> {STATUS_LABELS[status]}
    </span>
  );
}

function ItemRow({ item, showStatus = true }: { item: BacklogItem; showStatus?: boolean }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
        {item.priority && (
          <span className="rounded bg-muted px-1.5 text-xs font-semibold">{item.priority}</span>
        )}
        {showStatus && <StatusBadge status={item.status} />}
      </div>
      <p className="font-medium">{item.title}</p>
      {item.note && <p className="line-clamp-3 text-sm text-muted-foreground">{item.note}</p>}
    </li>
  );
}

export function ProjectOverview({ items }: { items: BacklogItem[] }) {
  const all = progressOf(items);
  const pct =
    all.total === 0 ? 0 : Math.round(((all.done + all.byStatus.review) / all.total) * 100);
  const active = items.filter((i) => i.status === "doing");
  const inReview = items.filter((i) => i.status === "review");
  const next = items
    .filter((i) => i.status === "todo" && (i.priority === "P0" || i.priority === "P1"))
    .sort((a, b) => (a.priority ?? "P9").localeCompare(b.priority ?? "P9"))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-bold">Andamento geral</h2>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{all.done}</strong> feitos e{" "}
            <strong className="text-foreground">{all.byStatus.review}</strong> em revisão, de{" "}
            {all.total} itens ({pct}% prontos)
          </p>
        </div>
        <ProgressBar
          done={all.done}
          review={all.byStatus.review}
          total={all.total}
          label="Andamento do backlog"
        />
        <ul className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <StatusBadge status={s} /> <span className="tabular-nums">{all.byStatus[s]}</span>
            </li>
          ))}
        </ul>
      </section>

      <Panel title="Por área">
        <ul className="divide-y">
          {GROUPS.map((group) => {
            const list = items.filter((i) => i.group === group);
            if (list.length === 0) return null;
            const p = progressOf(list);
            return (
              <li
                key={group}
                className="grid grid-cols-[minmax(0,1fr)_minmax(6rem,12rem)_3.5rem] items-center gap-3 px-4 py-3"
              >
                <span className="truncate font-medium">{group}</span>
                <ProgressBar
                  done={p.done}
                  review={p.byStatus.review}
                  total={p.total}
                  label={`Andamento de ${group}`}
                />
                <span className="text-right text-sm text-muted-foreground tabular-nums">
                  {p.done + p.byStatus.review}/{p.total}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={`Em andamento (${active.length})`}>
          {active.length ? (
            <ul className="divide-y">
              {active.map((i) => (
                <ItemRow key={i.id} item={i} showStatus={false} />
              ))}
            </ul>
          ) : (
            <PanelEmpty>Nada em andamento.</PanelEmpty>
          )}
        </Panel>
        <Panel title="Próximas prioridades (P0 e P1 a fazer)">
          {next.length ? (
            <ul className="divide-y">
              {next.map((i) => (
                <ItemRow key={i.id} item={i} showStatus={false} />
              ))}
            </ul>
          ) : (
            <PanelEmpty>Nenhuma prioridade pendente.</PanelEmpty>
          )}
        </Panel>
      </div>

      <Panel title={`Em revisão (${inReview.length}): feitos, aguardando aprovação`}>
        {inReview.length ? (
          <ul className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0">
            {inReview.map((i) => (
              <li key={i.id} className="flex gap-2 px-4 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{i.id}</span> {i.title}
              </li>
            ))}
          </ul>
        ) : (
          <PanelEmpty>Nada em revisão.</PanelEmpty>
        )}
      </Panel>
    </div>
  );
}

export function ProjectBoard({ items }: { items: BacklogItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {(["todo", "doing", "review", "done"] as ItemStatus[]).map((status) => {
        const list = items.filter((i) => i.status === status);
        return (
          <section key={status} className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted/60 p-3">
            <h2 className="flex items-center justify-between px-1 font-heading font-bold">
              {STATUS_LABELS[status]}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {list.length}
              </span>
            </h2>
            <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
              {list.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 rounded-md border bg-background p-3 shadow-xs"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{item.id}</span>
                    {item.priority && (
                      <span className="rounded bg-muted px-1.5 font-semibold">{item.priority}</span>
                    )}
                    <span className="ml-auto truncate">{item.group}</span>
                  </div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.note && status !== "done" && (
                    <p className="line-clamp-4 text-xs text-muted-foreground">{item.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const kindStyle: Record<Commit["kind"], string> = {
  added: "bg-emerald-50 text-emerald-800",
  fixed: "bg-red-50 text-red-800",
  changed: "bg-brand-sky-light text-brand-blue",
  docs: "bg-muted text-muted-foreground",
  chore: "bg-muted text-muted-foreground",
};

const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export function ProjectHistory({ commits }: { commits: Commit[] }) {
  if (commits.length === 0)
    return <PanelEmpty>Não foi possível ler o histórico do git.</PanelEmpty>;
  return (
    <ol className="flex flex-col gap-6">
      {groupByDay(commits).map(([day, list]) => (
        <li key={day} className="flex flex-col gap-2">
          <h2 className="font-heading font-bold first-letter:uppercase">
            {dayLabel.format(new Date(`${day}T12:00:00Z`))}
          </h2>
          <ul className="divide-y rounded-lg border bg-background shadow-xs">
            {list.map((c) => (
              <li
                key={c.hash}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
              >
                <span
                  className={cn(
                    "w-28 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium",
                    kindStyle[c.kind],
                  )}
                >
                  {KIND_LABELS[c.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  {c.scope && <span className="mr-1 text-muted-foreground">[{c.scope}]</span>}
                  {c.message}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {timeLabel.format(new Date(c.date))} · {c.hash}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function DocList({
  docs,
  active,
  href,
}: {
  docs: { key: string; label: string }[];
  active?: string;
  href: (key: string) => string;
}) {
  return (
    <nav aria-label="Documentos" className="flex flex-col gap-1">
      {docs.map((d) => (
        <Link
          key={d.key}
          href={href(d.key)}
          aria-current={d.key === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm break-words",
            d.key === active
              ? "bg-primary font-semibold text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          {d.label}
        </Link>
      ))}
    </nav>
  );
}
