import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Shipped badge map: default | success | destructive | purple | warning | orange | blue. */
export type BadgeVariant = "default" | "success" | "destructive" | "purple" | "warning" | "orange" | "blue" | "info" | "error";
const variants: Record<BadgeVariant, string> = {
  default: "bg-tint-secondary text-text-secondary",
  success: "bg-tint-green text-text-green",
  destructive: "bg-tint-red text-text-red",
  error: "bg-tint-red text-text-red",
  purple: "bg-tint-purple text-text-purple",
  warning: "bg-tint-orange text-text-orange",
  orange: "bg-tint-orange text-text-orange",
  blue: "bg-tint-blue text-text-blue",
  info: "bg-tint-blue text-text-blue",
};

export function Badge({ className, variant = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-[4px] px-1.5 text-11 font-medium leading-none", variants[variant], className)}
      {...props}
    />
  );
}

/** Small count badge used on filter buttons: `h-auto min-w-[14px] px-1 py-0 text-11` accent. */
export function CountBadge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-text-accent-primary text-text-always-white font-medium leading-4", className)}>
      {children}
    </span>
  );
}
