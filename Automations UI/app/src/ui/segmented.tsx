import { createContext, useContext, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Exact port of the segmented-control pair `Oa`/`ka` in app-initial-DnXLu_z9.js:
 *   container: `flex select-none items-center gap-px` + shape + optional `bg-tint-tertiary`
 *   item:      `text-text-secondary flex items-center justify-center border border-transparent`
 *              size medium `text-13 px-3 py-1` / small `text-12 px-2 py-0.5`
 *              pressed → `bg-bg-elevated-transparent text-text-primary border-border-secondary shadow-L1`
 */
type Ctx = { size: "small" | "medium"; variant: "rectangle" | "rounded" };
const SegCtx = createContext<Ctx>({ size: "medium", variant: "rectangle" });

export function SegmentedTabs({
  className, size = "medium", variant = "rectangle", background = true, value, children, ...rest
}: HTMLAttributes<HTMLDivElement> & { size?: Ctx["size"]; variant?: Ctx["variant"]; background?: boolean; value?: string[] }) {
  const shape = variant === "rounded" ? (background ? "rounded-[20px]" : "rounded-full") : "rounded-[7px]";
  return (
    <SegCtx.Provider value={{ size, variant }}>
      <div role="group" data-value={value?.join(",")} className={cn("flex select-none items-center gap-px", shape, background && "bg-tint-tertiary", className)} {...rest}>
        {children}
      </div>
    </SegCtx.Provider>
  );
}

export function SegmentedTab({ className, pressed, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; children: ReactNode }) {
  const { size, variant } = useContext(SegCtx);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-pressed={pressed ? "" : undefined}
      className={cn(
        "text-text-secondary flex items-center justify-center border border-transparent",
        size === "small" ? "text-12 px-2 py-0.5" : "text-13 px-3 py-1",
        variant === "rounded" ? "rounded-full" : "rounded-[6px]",
        "hover:enabled:text-text-primary",
        "data-[pressed]:bg-bg-elevated-transparent data-[pressed]:text-text-primary data-[pressed]:border-border-secondary data-[pressed]:shadow-L1 light:data-[pressed]:bg-clip-padding",
        "focus-ring",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** `yn`/`J` — disabled-text count appended with left margin. */
export function TabCount({ value }: { value: number }) {
  return <span className="ml-1 text-text-disabled">{value}</span>;
}
