import type { JSONContent } from "@tiptap/react";

import { escapeHtml } from "@/lib/html";
import type { ArticleBlock } from "@/types/news";

// Conversão entre o documento do editor (Tiptap) e o corpo em blocos do contrato.
// Só passam os formatos que o site sabe exibir: negrito, itálico e link nos parágrafos;
// intertítulo, citação e listas como blocos. O resto (sublinhado, código...) é descartado.

/** Documento do editor → blocos (para salvar). */
export function docToBlocks(doc: JSONContent): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "paragraph": {
        const html = inlineHtml(node.content);
        if (html.trim()) blocks.push({ type: "paragraph", html });
        break;
      }
      case "heading": {
        const text = plainText(node).trim();
        if (text) blocks.push({ type: "heading", text });
        break;
      }
      case "blockquote": {
        const text = (node.content ?? []).map(plainText).join(" ").trim();
        if (text) blocks.push({ type: "quote", text });
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? []).map((li) => plainText(li).trim()).filter(Boolean);
        if (items.length)
          blocks.push({ type: "list", ordered: node.type === "orderedList", items });
        break;
      }
    }
  }
  return blocks;
}

/** Blocos → HTML que o editor entende (para carregar uma notícia existente). */
export function blocksToEditorHtml(blocks: ArticleBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return `<p>${block.html}</p>`;
        case "heading":
          return `<h2>${escapeHtml(block.text)}</h2>`;
        case "quote":
          return `<blockquote><p>${escapeHtml(block.text)}</p></blockquote>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          return `<${tag}>${block.items.map((i) => `<li><p>${escapeHtml(i)}</p></li>`).join("")}</${tag}>`;
        }
        default:
          // Imagem/vídeo dentro do corpo entram com o upload de mídia (BE-012).
          return "";
      }
    })
    .join("");
}

function inlineHtml(nodes: JSONContent[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";
      if (node.type !== "text" || !node.text) return "";
      let html = escapeHtml(node.text);
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") html = `<strong>${html}</strong>`;
        else if (mark.type === "italic") html = `<em>${html}</em>`;
      }
      const link = node.marks?.find((m) => m.type === "link");
      const href = typeof link?.attrs?.href === "string" ? link.attrs.href : "";
      if (href && /^(https?:\/\/|\/|mailto:)/i.test(href))
        html = `<a href="${escapeHtml(href)}">${html}</a>`;
      return html;
    })
    .join("");
}

function plainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join(node.type === "paragraph" ? "" : " ");
}

/** Palavras do corpo (contagem e tempo de leitura no editor). */
export function countWords(blocks: ArticleBlock[]): number {
  const text = blocks
    .map((b) =>
      b.type === "paragraph"
        ? b.html.replace(/<[^>]+>/g, " ")
        : b.type === "list"
          ? b.items.join(" ")
          : "text" in b
            ? b.text
            : "",
    )
    .join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}
