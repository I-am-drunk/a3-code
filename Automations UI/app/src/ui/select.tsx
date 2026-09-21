import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { selectTriggerClass } from "./button";

export type SelectOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  disabledReason?: ReactNode;
};

/**
 * Anchored dark select with item checkmark on the selected value and optional
 * description line (agent type / agent mode / run-as; see live-ui 09–11).
 */
export function Select<V extends string>({
  value, onValueChange, options, placeholder, className, contentClassName, triggerClassName, disabled, ariaLabel,
  itemsWithDescription, align = "end", renderValue, size = "default",
}: {
  value: V | null | undefined;
  onValueChange: (v: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  triggerClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  itemsWithDescription?: boolean;
  align?: "start" | "center" | "end";
  renderValue?: (opt: SelectOption<V> | undefined) => ReactNode;
  size?: "default" | "compact" | "inline";
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <SelectPrimitive.Root value={value ?? undefined} onValueChange={(v) => onValueChange(v as V)} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          selectTriggerClass,
          size === "compact" && "h-[28px] px-2 gap-1 text-13",
          size === "inline" && "h-[24px] min-w-[unset] rounded-[4px] border-0 bg-tint-accent-secondary px-[5px] py-0.5 text-13 font-medium text-text-accent-primary can-hover:hover:bg-tint-accent-secondary data-[placeholder]:text-text-accent-primary/70",
          className, triggerClassName,
        )}
      >
        <span className="min-w-0 truncate text-left">
          {renderValue ? renderValue(selected) : <SelectPrimitive.Value placeholder={placeholder} />}
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className={cn("shrink-0 text-text-secondary", size === "inline" ? "!size-3.5 !text-text-accent-primary" : "!size-4")} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          align={align}
          sideOffset={4}
          className={cn("z-[70] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-border-secondary bg-bg-elevated p-1 text-text-primary shadow-L3 menu-in", contentClassName)}
        >
          <SelectPrimitive.Viewport className="max-h-[320px]">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cn(
                  "relative flex cursor-default select-none rounded-[6px] px-2.5 pr-8 text-13 text-text-primary outline-none data-[highlighted]:bg-tint-secondary data-[disabled]:pointer-events-none",
                  itemsWithDescription || o.description ? "flex-col items-start gap-0.5 py-1.5" : "h-[30px] items-center",
                  o.disabled && "text-text-disabled",
                )}
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.disabled && o.disabledReason ? (
                  <span className="whitespace-normal text-left text-12 text-text-disabled">{o.disabledReason}</span>
                ) : o.description ? (
                  <span className="whitespace-normal text-left text-12 text-text-secondary">{o.description}</span>
                ) : null}
                <SelectPrimitive.ItemIndicator className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
