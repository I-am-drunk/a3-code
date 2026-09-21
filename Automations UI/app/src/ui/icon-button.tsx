import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Exact port of the shipped icon-button cva (`Bt`/`Vt` in app-initial-QHPckIVR.js).
 * Used for the detail overflow trigger (`variant="ghost"`, default square/md) and the sidebar toggle.
 */
export type IconButtonVariant = "primary-accent" | "primary" | "secondary" | "ghost" | "ghost-tight" | "ghost-quiet" | "warning" | "warning-muted";
export type IconButtonShape = "square" | "circle" | "nobg";
export type IconButtonSize = "lg" | "md" | "sm" | "xs" | "xxs";

const base = "inline-flex items-center justify-center outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 shrink-0 focus-ring";

const variants: Record<IconButtonVariant, string> = {
  "primary-accent": "bg-bg-accent-primary text-text-always-white border border-border-secondary-always-black hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  primary: "bg-bg-accent-neutral text-text-primary-inverse border border-border-secondary-always-black hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  secondary: "bg-bg-elevated-transparent text-text-primary border border-border-secondary light:bg-clip-padding hover:text-text-primary hover:bg-[image:linear-gradient(rgb(var(--tint-tertiary)),rgb(var(--tint-tertiary))),linear-gradient(rgb(var(--bg-elevated-transparent)),rgb(var(--bg-elevated-transparent)))] data-[pressed]:bg-[image:linear-gradient(rgb(var(--tint-tertiary)),rgb(var(--tint-tertiary))),linear-gradient(rgb(var(--bg-elevated-transparent)),rgb(var(--bg-elevated-transparent)))]",
  ghost: "bg-transparent text-text-secondary hover:bg-tint-secondary hover:text-text-primary data-[pressed]:bg-tint-secondary data-[pressed]:text-text-primary",
  "ghost-tight": "!p-0 bg-transparent text-text-secondary hover:text-text-primary data-[pressed]:text-text-primary",
  "ghost-quiet": "bg-transparent text-text-secondary hover:text-text-primary data-[pressed]:text-text-primary",
  warning: "bg-tint-orange text-text-orange hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  "warning-muted": "bg-transparent text-text-orange hover:bg-tint-orange data-[pressed]:bg-tint-orange",
};
const shapes: Record<IconButtonShape, string> = { square: "rounded-[6px]", circle: "rounded-full", nobg: "bg-transparent hover:bg-transparent" };
const sizes: Record<IconButtonSize, string> = {
  lg: "size-8 [&_svg]:size-[20px]",
  md: "size-7 [&_svg]:size-[18px]",
  sm: "size-6 [&_svg]:size-[16px]",
  xs: "size-5 [&_svg]:size-[14px]",
  xxs: "size-[14px] [&_svg]:size-[14px]",
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  shape?: IconButtonShape;
  size?: IconButtonSize;
  pressed?: boolean;
  asChild?: boolean;
};

export function iconButtonClass({ variant = "primary-accent", shape = "square", size = "md", className }: Pick<IconButtonProps, "variant" | "shape" | "size" | "className">) {
  return cn(base, variants[variant], shapes[shape], sizes[size], className);
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = "primary-accent", shape = "square", size = "md", pressed, asChild, type = "button", ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} {...(asChild ? {} : { type })} data-pressed={pressed ? "" : undefined} className={iconButtonClass({ variant, shape, size, className })} {...props} />;
});
