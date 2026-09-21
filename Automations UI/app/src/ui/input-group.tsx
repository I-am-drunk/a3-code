import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Exact port of InputGroup (`Zi`), InputGroupAddon (`Qi`) and InputGroupInput from
 * app-initial-QHPckIVR.js. The shell is h-7, rounded-[6px], secondary border, elevated-transparent bg.
 */
export function InputGroup({ className, focusOutline = true, children, ...rest }: HTMLAttributes<HTMLDivElement> & { focusOutline?: boolean }) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        "group/input-group flex items-center relative w-full min-w-0 rounded-[6px] outline-none",
        "bg-bg-elevated-transparent text-text-primary placeholder:text-text-secondary",
        "border-border-secondary border light:bg-clip-padding",
        "has-[textarea]:hover:bg-transparent has-[textarea]:h-auto h-7",
        "has-disabled:opacity-50",
        focusOutline
          ? "has-[[data-slot=input-group-control]:focus-visible]:border-text-accent-primary has-[[data-slot][aria-invalid=true]]:border-text-red"
          : "has-[[data-slot=input-group-control]:focus-visible]:border-border-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function InputGroupAddon({ align = "inline-start", className, children }: { align?: "inline-start" | "inline-end" | "block-start" | "block-end"; className?: string; children: ReactNode }) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        "text-text-secondary h-auto gap-2 text-12 group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[3px] [&>svg:not([class*='size-'])]:size-[16px] flex cursor-text items-center justify-center select-none",
        align === "inline-start" && "pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem] order-first",
        align === "inline-end" && "pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem] order-last",
        align === "block-start" && "px-2.5 pt-2 pb-2 order-first w-full justify-start",
        align === "block-end" && "px-2.5 pb-2 pt-2 order-last w-full justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const InputGroupInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function InputGroupInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      data-slot="input-group-control"
      className={cn(
        "aria-invalid:outline-none flex-1 rounded-none border-0 bg-transparent shadow-none outline-none hover:bg-transparent focus-visible:outline-0 disabled:bg-transparent",
        "h-full min-w-0 px-2 text-13 text-text-primary placeholder:text-text-secondary",
        "group-has-[[data-align=inline-end]]/input-group:pr-[6px] group-has-[[data-align=inline-start]]/input-group:pl-[6px]",
        className,
      )}
      {...props}
    />
  );
});
