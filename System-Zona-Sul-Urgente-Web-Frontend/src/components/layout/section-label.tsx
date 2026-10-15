"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { allSections } from "@/config/navigation";

// Nome da editoria ao lado do logo (como "CNN Nacional"): aparece na página da editoria
// e nas matérias dela, porque a URL começa com o slug da editoria (/economia/...).
// Oculto entre lg e xl, onde a barra já mostra as editorias (a atual fica sublinhada).
export function SectionLabel() {
  const pathname = usePathname();
  const slug = pathname.split("/")[1];
  const section = allSections.find((s) => s.slug === slug);
  if (!section) return null;

  return (
    <Link
      href={section.href}
      data-section-label
      className="mr-2 -ml-1 truncate font-heading text-lg leading-none font-bold text-white [font-stretch:75%] hover:underline focus-visible:outline-white sm:text-2xl sm:[font-stretch:87.5%] lg:max-xl:hidden"
    >
      {section.label}
    </Link>
  );
}
