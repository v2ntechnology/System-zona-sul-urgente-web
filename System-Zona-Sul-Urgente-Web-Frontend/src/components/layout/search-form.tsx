import { SearchIcon } from "lucide-react";

import { routes } from "@/config/navigation";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  className?: string;
  defaultValue?: string;
  autoFocus?: boolean;
};

// Formulário GET para /busca?q=… — funciona sem JavaScript e a URL guarda o termo (FE-106).
export function SearchForm({ className, defaultValue, autoFocus }: SearchFormProps) {
  return (
    <form action={routes.search} method="get" role="search" className={cn("relative", className)}>
      <label htmlFor="search-q" className="sr-only">
        Buscar notícias
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        required
        maxLength={120}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Buscar notícias"
        className="h-11 w-full rounded-md border border-input bg-background pr-11 pl-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-brand-blue"
      >
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
