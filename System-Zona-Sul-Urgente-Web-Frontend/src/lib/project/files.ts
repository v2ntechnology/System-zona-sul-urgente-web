import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { type Commit, parseCommitLine } from "@/lib/project/history";

// Painel do projeto: lê docs/, specs/, a constituição do Spec Kit e o histórico do git direto da
// máquina de quem desenvolve. Só existe em `next dev`: o build standalone não leva esses arquivos.

export const projectPanelEnabled = process.env.NODE_ENV === "development";

/** Raiz do repositório (o Next roda dentro de System-Zona-Sul-Urgente-Web-Frontend/). */
const ROOT = path.resolve(process.cwd(), "..");
const DOCS = path.join(ROOT, "docs");
const SPECS = path.join(ROOT, "specs");
const CONSTITUTION = path.join(ROOT, ".specify", "memory", "constitution.md");

export type ProjectDoc = { key: string; label: string; file: string };

const markdownIn = async (dir: string) =>
  (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".md")).sort();

/**
 * Documentos de docs/ (backlog, changelog), os capítulos do manual do cliente e da documentação
 * técnica (docs/documentacao/) e as regras do projeto. `key` é o que vai na URL (?doc=).
 */
export async function listDocs(): Promise<ProjectDoc[]> {
  const docs = (await markdownIn(DOCS)).map((f) => ({
    key: f.replace(/\.md$/, ""),
    label: f,
    file: path.join(DOCS, f),
  }));
  const chapters = async (dir: "usuario" | "tecnico", label: string) =>
    (await markdownIn(path.join(DOCS, "documentacao", dir))).map((f) => ({
      key: `${dir}/${f.replace(/\.md$/, "")}`,
      label: `${label} · ${f.replace(/\.md$/, "")}`,
      file: path.join(DOCS, "documentacao", dir, f),
    }));
  return [
    ...docs,
    ...(await chapters("usuario", "Manual")),
    ...(await chapters("tecnico", "Técnico")),
    {
      key: "regras",
      label: "Regras do projeto (.claude/CLAUDE.md)",
      file: path.join(ROOT, ".claude", "CLAUDE.md"),
    },
  ];
}

/**
 * Constituição e os arquivos de cada spec (specs/NNN-nome/*.md e checklists/*.md), na ordem
 * do fluxo do Spec Kit. `key` = caminho relativo à raiz.
 */
export async function listSpecs(): Promise<ProjectDoc[]> {
  const order = ["spec.md", "research.md", "data-model.md", "plan.md", "tasks.md", "quickstart.md"];
  const rank = (f: string) => (order.includes(f) ? order.indexOf(f) : order.length);
  const dirs = (await readdir(SPECS, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const specs: ProjectDoc[] = [];
  for (const dir of dirs) {
    const files = (await markdownIn(path.join(SPECS, dir))).sort((a, b) => rank(a) - rank(b));
    const checklists = (await markdownIn(path.join(SPECS, dir, "checklists"))).map(
      (f) => `checklists/${f}`,
    );
    for (const f of [...files, ...checklists]) {
      specs.push({
        key: `specs/${dir}/${f}`,
        label: `${dir} · ${f}`,
        file: path.join(SPECS, dir, f),
      });
    }
  }
  return [{ key: "constituicao", label: "Constituição", file: CONSTITUTION }, ...specs];
}

/** Conteúdo de um documento da lista (nunca um caminho vindo da URL). */
export async function readFrom(
  list: ProjectDoc[],
  key: string | undefined,
): Promise<{ doc: ProjectDoc; content: string } | null> {
  const doc = list.find((d) => d.key === key) ?? list[0];
  if (!doc) return null;
  const content = await readFile(doc.file, "utf8").catch(() => null);
  return content === null ? null : { doc, content };
}

export async function readBacklog(): Promise<string> {
  return readFile(path.join(DOCS, "backlog.md"), "utf8").catch(() => "");
}

export async function readChangelog(): Promise<string> {
  return readFile(path.join(DOCS, "changelog.md"), "utf8").catch(() => "");
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
