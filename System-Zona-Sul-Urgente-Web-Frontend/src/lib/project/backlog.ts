// Painel do projeto (só em desenvolvimento): lê o doc/BACKLOG.md e devolve os itens com o
// andamento. Formato dos itens: "## FE-101 — Título" e, no bloco, "**Status:** Review (...)".

export type ItemStatus = "todo" | "doing" | "review" | "done";

export type BacklogItem = {
  id: string;
  title: string;
  group: string;
  status: ItemStatus;
  /** O texto do status como está no documento (ex.: "Parcial (2026-10-16): ..."). */
  note: string;
  priority?: string;
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  review: "Em revisão",
  done: "Feito",
};

/** Ordem das áreas: segue a construção (fundação → site → painel → backend → entrega). */
export const GROUPS = [
  "Fundação",
  "Contrato",
  "Portal público",
  "Painel",
  "Backend",
  "Qualidade e entrega",
] as const;

/** Área pelo código (os itens novos ficam no fim do arquivo, fora da seção certa). */
export function groupOf(id: string): string {
  const [prefix, raw] = id.split("-");
  const n = Number(raw);
  if (prefix === "BE") return "Backend";
  if (prefix === "CT") return "Contrato";
  if (prefix === "QA" || prefix === "OPS") return "Qualidade e entrega";
  if (n < 100) return "Fundação";
  if (n < 150) return "Portal público";
  return "Painel";
}

export function statusOf(text: string | undefined): ItemStatus {
  const t = (text ?? "").trim().toLowerCase();
  if (/^(done|concluíd|feito)/.test(t)) return "done";
  if (/^review/.test(t)) return "review";
  if (/^(in progress|parcial|em andamento)/.test(t)) return "doing";
  return "todo";
}

const ITEM = /^## ((?:FE|BE|QA|OPS|CT)-\d+)\s+[—-]\s+(.+?)\s*$/;
const STATUS = /\*\*Status:\*\*\s*(.+)$/;
const PRIORITY = /\*\*Prioridade:\*\*\s*(P\d)/;

export function parseBacklog(markdown: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  let current: BacklogItem | null = null;
  for (const line of markdown.split("\n")) {
    const item = ITEM.exec(line);
    if (item) {
      current = {
        id: item[1],
        title: item[2],
        group: groupOf(item[1]),
        status: "todo",
        note: "",
      };
      items.push(current);
      continue;
    }
    // Outro título fecha o item atual.
    if (/^#{1,2} /.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    const priority = PRIORITY.exec(line);
    if (priority && !current.priority) current.priority = priority[1];
    const status = STATUS.exec(line);
    if (status && !current.note) {
      current.note = status[1].replace(/\*\*/g, "").trim();
      current.status = statusOf(current.note);
    }
  }
  return items;
}

export type Progress = { done: number; total: number; byStatus: Record<ItemStatus, number> };

export function progressOf(items: BacklogItem[]): Progress {
  const byStatus: Record<ItemStatus, number> = { todo: 0, doing: 0, review: 0, done: 0 };
  for (const item of items) byStatus[item.status]++;
  return { done: byStatus.done, total: items.length, byStatus };
}
