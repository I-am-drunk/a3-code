import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: CheckboxPrimitive.CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-primary bg-bg-elevated outline-none focus-visible:ring-2 focus-visible:ring-border-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-bg-accent-primary data-[state=checked]:bg-bg-accent-primary data-[state=indeterminate]:border-bg-accent-primary data-[state=indeterminate]:bg-bg-accent-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-text-always-white">
        {props.checked === "indeterminate" ? <Minus size={11} strokeWidth={3} /> : <Check size={11} strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
