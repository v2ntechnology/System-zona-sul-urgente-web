import { Fragment } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { ArticleFigure, ArticleVideo } from "@/components/article/article-media";
import { sanitizeInlineHtml } from "@/lib/sanitize";
import type { ArticleBlock } from "@/types/news";

/** O anúncio do meio entra depois deste parágrafo (se o texto for longo o bastante). */
const AD_AFTER_PARAGRAPH = 2;

// Renderiza o corpo em blocos (contrato ArticleBlock). HTML só nos parágrafos, sanitizado.
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  const paragraphIndexes = blocks.flatMap((block, index) =>
    block.type === "paragraph" ? [index] : [],
  );
  // Índice do bloco após o qual entra o anúncio; -1 = texto curto demais, sem anúncio.
  const adAfter =
    paragraphIndexes.length > AD_AFTER_PARAGRAPH ? paragraphIndexes[AD_AFTER_PARAGRAPH - 1] : -1;

  return (
    <div className="flex flex-col gap-6 text-article [&_a]:font-medium [&_a]:text-brand-blue [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-brand-blue-dark">
      {blocks.map((block, index) => (
        <Fragment key={index}>
          <Block block={block} />
          {index === adAfter && <AdSlot slotKey="ARTICLE_MIDDLE" />}
        </Fragment>
      ))}
    </div>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(block.html) }} />;
    case "heading":
      return <h2 className="text-headline">{block.text}</h2>;
    case "quote":
      return (
        <blockquote className="border-l-4 border-brand-red pl-5">
          <p className="font-heading text-title font-bold">“{block.text}”</p>
          {block.source && (
            <footer className="mt-2 text-sm text-muted-foreground">— {block.source}</footer>
          )}
        </blockquote>
      );
    case "image":
      return <ArticleFigure image={block.image} />;
    case "video":
      return <ArticleVideo video={block.video} />;
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className={block.ordered ? "list-decimal pl-6" : "list-disc pl-6"}>
          {block.items.map((item, index) => (
            <li key={index} className="mt-1">
              {item}
            </li>
          ))}
        </List>
      );
    }
  }
}
