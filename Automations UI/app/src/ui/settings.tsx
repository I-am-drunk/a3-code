import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Exact ports from app-initial-DnXLu_z9.js:
 *   Qi → SettingsCardGroup  `bg-tint-tertiary overflow-hidden rounded-[10px]`
 *   $i → SettingsCard       `bg-bg-elevated border-border-secondary rounded-[10px] border px-4 divide-y`
 *   ea → SettingsRow        `flex min-h-[64px] flex-col justify-center gap-[14px] py-[14px]` with label/description/control/content
 * and useRunAsIdentityChange `_` → LabeledControlRow `flex items-center justify-between gap-4`.
 */
export function SettingsCardGroup({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-tint-tertiary overflow-hidden rounded-[10px]", className)} {...rest}>{children}</div>;
}

export function SettingsCard({ className, children, noDividers, ...rest }: HTMLAttributes<HTMLDivElement> & { noDividers?: boolean }) {
  return (
    <div className={cn("bg-bg-elevated border-border-secondary rounded-[10px] border px-[var(--settings-card-px)] [--settings-card-px:1rem]", !noDividers && "divide-border-secondary divide-y", className)} {...rest}>
      {children}
    </div>
  );
}

export function SettingsRow({
  label, description, children, className, content, banner, orientation = "horizontal", boldLabel,
}: {
  label?: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; content?: ReactNode; banner?: ReactNode;
  orientation?: "horizontal" | "vertical"; boldLabel?: boolean;
}) {
  return (
    <div className={cn("flex min-h-[64px] flex-col justify-center gap-[14px] py-[14px]", className)}>
      {banner}
      {(label || description) ? (
        <div className={cn("flex gap-[8px]", orientation === "horizontal" ? "flex-row flex-wrap items-center justify-between md:flex-nowrap" : "flex-col")}>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-[2px]">
              {label && <h4 className={cn("text-13 text-text-primary", boldLabel ? "font-medium" : "font-normal")}>{label}</h4>}
              {description && <div className="text-13 text-text-secondary">{description}</div>}
            </div>
          </div>
          <div className={cn("relative flex items-center gap-1.5", orientation === "vertical" && "w-full")}>{children}</div>
        </div>
      ) : children}
      {content}
    </div>
  );
}

/** `_` in useRunAsIdentityChange — bold label + description, control on the right. */
export function LabeledControlRow({ label, description, control, className }: { label: ReactNode; description?: ReactNode; control: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <label className="text-13 font-medium text-text-primary">{label}</label>
        {description && <p className="text-13 text-text-secondary">{description}</p>}
      </div>
      {control}
    </div>
  );
}

/** `L` in NotificationsSection / `Vr` in the editor — section title, description, right action. */
export function SectionHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-13 font-medium text-text-primary">{title}</h3>
        {description && <p className="text-13 text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** `Yn` — accent chip used for the trigger event pill and inline schedule selects. */
export const ACCENT_CHIP = "inline-flex h-[24px] shrink-0 items-center rounded-[4px] bg-tint-accent-secondary px-[5px] text-13 font-medium text-text-accent-primary";
