import { cn } from "@/lib/utils";

/** Largura padrão do site (token --container-site) com respiro lateral. */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-site px-4", className)} {...props} />;
}
