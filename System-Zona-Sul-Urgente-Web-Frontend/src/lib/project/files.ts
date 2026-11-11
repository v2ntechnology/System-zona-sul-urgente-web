import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { type Commit, parseCommitLine } from "@/lib/project/history";

// Painel do projeto: lê doc/ (fora do git, regra 2) e o histórico do git direto da máquina de
// quem desenvolve. Por isso só existe em `next dev`: no build/servidor esses arquivos não existem.

export const projectPanelEnabled = process.env.NODE_ENV === "development";

/** Raiz do repositório (o Next roda dentro de System-Zona-Sul-Urgente-Web-Frontend/). */
const ROOT = path.resolve(process.cwd(), "..");

export type ProjectDoc = { key: string; label: string; file: string };

/** Documentos de doc/ e as regras do projeto. `key` é o que vai na URL (?doc=). */
export async function listDocs(): Promise<ProjectDoc[]> {
  const files = await readdir(path.join(ROOT, "doc")).catch(() => [] as string[]);
  const docs = files
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ key: f.replace(/\.md$/, ""), label: f, file: path.join(ROOT, "doc", f) }));
  return [
    ...docs,
    {
      key: "regras",
      label: "Regras do projeto (.claude/CLAUDE.md)",
      file: path.join(ROOT, ".claude", "CLAUDE.md"),
    },
  ];
}

/** Conteúdo de um documento da lista (nunca um caminho vindo da URL). */
export async function readDoc(key: string): Promise<{ doc: ProjectDoc; content: string } | null> {
  const doc = (await listDocs()).find((d) => d.key === key);
  if (!doc) return null;
  const content = await readFile(doc.file, "utf8").catch(() => null);
  return content === null ? null : { doc, content };
}

export async function readBacklog(): Promise<string> {
  return readFile(path.join(ROOT, "doc", "BACKLOG.md"), "utf8").catch(() => "");
}

/** Últimos commits (assunto, data, hash). */
export async function readHistory(limit = 300): Promise<Commit[]> {
  const { stdout } = await promisify(execFile)(
    "git",
    ["log", `-n${limit}`, "--pretty=format:%h%x1f%aI%x1f%s"],
    { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 },
  ).catch(() => ({ stdout: "" }));
  return stdout
    .split("\n")
    .map(parseCommitLine)
    .filter((c): c is Commit => c !== null);
}
