import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Ported from the shipped button variant map in app-initial (cva):
 *   variant: primary-accent | primary | secondary | destructive | destructive-muted | ghost | ghost-tight | ghost-quiet | link | warning | warning-muted
 *   size:    default `px-[10px] h-[28px] gap-[4px] text-13 [&_svg]:size-[16px]`
 *            sm      `px-[8px] h-[24px] gap-[3px] text-12 [&_svg]:size-[14px]`
 *            md      `px-[12px] h-[32px] gap-[5px] text-14 [&_svg]:size-[16px]`
 *            lg      `px-[14px] h-[38px] gap-[6px] text-15 [&_svg]:size-[18px]`
 */
export type ButtonVariant =
  | "primary-accent" | "primary" | "secondary" | "destructive" | "destructive-muted"
  | "ghost" | "ghost-tight" | "ghost-quiet" | "link" | "warning" | "warning-muted";
export type ButtonSize = "default" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const secondaryHover =
  "can-hover:hover:bg-[image:linear-gradient(rgb(var(--tint-tertiary)),rgb(var(--tint-tertiary))),linear-gradient(rgb(var(--bg-elevated-transparent)),rgb(var(--bg-elevated-transparent)))] data-[pressed]:bg-[image:linear-gradient(rgb(var(--tint-tertiary)),rgb(var(--tint-tertiary))),linear-gradient(rgb(var(--bg-elevated-transparent)),rgb(var(--bg-elevated-transparent)))]";

export const buttonVariants: Record<ButtonVariant, string> = {
  "primary-accent": "bg-bg-accent-primary border border-border-primary-always-black text-text-always-white can-hover:hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  primary: "bg-bg-accent-neutral border border-border-primary-always-black text-text-primary-inverse can-hover:hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  destructive: "bg-bg-destructive border border-border-primary-always-black text-text-always-white can-hover:hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  "destructive-muted": cn("bg-bg-elevated-transparent text-text-red border border-border-primary light:bg-clip-padding can-hover:hover:text-text-red", secondaryHover),
  secondary: cn("bg-bg-elevated-transparent text-text-primary border border-border-primary light:bg-clip-padding can-hover:hover:text-text-primary", secondaryHover),
  ghost: "bg-transparent text-text-secondary border border-transparent can-hover:hover:bg-tint-secondary can-hover:hover:text-text-primary data-[pressed]:bg-tint-secondary data-[pressed]:text-text-primary",
  "ghost-tight": "!p-0 bg-transparent text-text-secondary can-hover:hover:text-text-primary data-[pressed]:text-text-primary",
  "ghost-quiet": "bg-transparent text-text-secondary can-hover:hover:text-text-primary data-[pressed]:text-text-primary",
  link: "bg-transparent text-text-secondary border border-transparent can-hover:hover:text-text-primary data-[pressed]:text-text-primary",
  warning: "bg-tint-orange text-text-orange border border-transparent can-hover:hover:brightness-[.92] data-[pressed]:brightness-[.85]",
  "warning-muted": "bg-transparent text-text-orange border border-transparent can-hover:hover:bg-tint-orange data-[pressed]:bg-tint-orange",
};

export const buttonSizes: Record<ButtonSize, string> = {
  default: "px-[10px] h-[28px] gap-[4px] text-13 [&_svg]:size-[16px]",
  sm: "px-[8px] h-[24px] gap-[3px] text-12 [&_svg]:size-[14px]",
  md: "px-[12px] h-[32px] gap-[5px] text-14 [&_svg]:size-[16px]",
  lg: "px-[14px] h-[38px] gap-[6px] text-15 [&_svg]:size-[18px]",
  icon: "size-[28px] p-0 text-13 [&_svg]:size-[16px]",
  "icon-sm": "size-[24px] p-0 text-12 [&_svg]:size-[14px]",
};

export const buttonBase =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-[6px] font-medium outline-none transition-[filter,background-color,color] duration-100 focus-visible:ring-2 focus-visible:ring-border-primary disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pressed?: boolean;
  /** Render the child element with button classes (the shipped `render` prop). */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "default", pressed, asChild, type = "button", ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      {...(asChild ? {} : { type })}
      data-pressed={pressed ? "" : undefined}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
});

/** Trigger-shaped select/menu button: same chrome as `secondary` with a chevron slot. */
export const selectTriggerClass = cn(
  buttonBase,
  buttonVariants.secondary,
  "h-[32px] justify-between gap-2 px-[10px] text-13 font-normal data-[placeholder]:text-text-secondary",
);
