"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";

import { blocksToEditorHtml, docToBlocks } from "@/lib/editor/blocks";
import { cn } from "@/lib/utils";
import type { ArticleBlock } from "@/types/news";

type RichTextEditorProps = {
  initialBlocks: ArticleBlock[];
  /** Recebe o corpo já convertido para blocos (contrato da API). */
  onChange: (blocks: ArticleBlock[]) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  /** Sem moldura: o texto se integra ao painel (editor estilo post do Instagram). */
  bare?: boolean;
};

// Editor do corpo da matéria (FE-154) com Tiptap. Só os formatos que o site exibe:
// negrito, itálico, link, intertítulo, citação e listas (o resto vem desligado).
export function RichTextEditor({
  initialBlocks,
  onChange,
  invalid,
  describedBy,
  placeholder,
  bare,
}: RichTextEditorProps) {
  const editor = useEditor({
    // Next/SSR: o editor só monta no navegador.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: null, target: null },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: blocksToEditorHtml(initialBlocks),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Texto da matéria",
        ...(describedBy && { "aria-describedby": describedBy }),
        class:
          "min-h-60 px-4 py-3 text-article outline-none [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_a]:text-brand-blue [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-brand-red [&_blockquote]:pl-4 [&_blockquote]:font-heading [&_blockquote]:font-bold [&_h2]:mt-4 [&_h2]:text-headline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
      },
    },
    // Corpo inicial também passa pelo conversor: o que vai para a API e para a
    // pré-visualização é sempre a saída do conversor (só formatos permitidos).
    onCreate: ({ editor }) => onChange(docToBlocks(editor.getJSON())),
    onUpdate: ({ editor }) => onChange(docToBlocks(editor.getJSON())),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        link: e.isActive("link"),
        heading: e.isActive("heading", { level: 2 }),
        quote: e.isActive("blockquote"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      },
  });

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "Endereço do link (https://... ou /caminho-no-site):",
      previous ?? "https://",
    );
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|\/|mailto:)/i.test(url.trim())) {
      window.alert("Use um endereço que comece com https://, / ou mailto:.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const tools = editor
    ? [
        {
          label: "Negrito",
          icon: BoldIcon,
          active: state?.bold,
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: "Itálico",
          icon: ItalicIcon,
          active: state?.italic,
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        { label: "Link", icon: LinkIcon, active: state?.link, run: setLink },
        {
          label: "Intertítulo",
          icon: Heading2Icon,
          active: state?.heading,
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: "Citação",
          icon: QuoteIcon,
          active: state?.quote,
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: "Lista",
          icon: ListIcon,
          active: state?.bullet,
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: "Lista numerada",
          icon: ListOrderedIcon,
          active: state?.ordered,
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
      ]
    : [];

  return (
    <div
      className={cn(
        "bg-background",
        bare
          ? cn("rounded-md", invalid && "ring-2 ring-destructive/60")
          : cn(
              "overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring/30",
              invalid ? "border-destructive" : "border-input",
            ),
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatação do texto"
        className={cn(
          "flex flex-wrap items-center gap-0.5 p-1",
          bare ? "rounded-md bg-muted/60" : "border-b bg-muted/50",
        )}
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={Boolean(tool.active)}
            // Não tira o foco do texto ao clicar: senão o que se digita depois se perde.
            onMouseDown={(event) => event.preventDefault()}
            onClick={tool.run}
            className="inline-flex size-8 items-center justify-center rounded hover:bg-background aria-pressed:bg-background aria-pressed:text-brand-blue aria-pressed:shadow-xs"
          >
            <tool.icon aria-hidden className="size-4" />
          </button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          title="Desfazer"
          aria-label="Desfazer"
          onMouseDown={(event) => event.preventDefault()}
          disabled={!state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
          className="inline-flex size-8 items-center justify-center rounded hover:bg-background disabled:opacity-40"
        >
          <Undo2Icon aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          title="Refazer"
          aria-label="Refazer"
          onMouseDown={(event) => event.preventDefault()}
          disabled={!state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
          className="inline-flex size-8 items-center justify-center rounded hover:bg-background disabled:opacity-40"
        >
          <Redo2Icon aria-hidden className="size-4" />
        </button>
      </div>
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="min-h-60 animate-pulse bg-muted/40" />
      )}
    </div>
  );
}
