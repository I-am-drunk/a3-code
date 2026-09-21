import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content, children, side = "top", align = "center", className, disabled, delayDuration = 300, sideOffset = 6,
}: {
  content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end"; className?: string; disabled?: boolean; delayDuration?: number; sideOffset?: number;
}) {
  if (disabled || content === null || content === undefined || content === false) return <>{children}</>;
  // A natively disabled control swallows pointer events (`disabled:pointer-events-none`), so reason tooltips
  // (spending frozen, permission lock, incident run) would never open. Mirror the shipped behavior — the dimmed
  // control keeps its tooltip — by hosting the trigger on an inline wrapper when the (possibly nested) child is disabled.
  const trigger = hasDisabledControl(children) ? <span tabIndex={0} className="inline-flex outline-none">{children}</span> : children;
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={cn("z-[80] max-w-[280px] rounded-[6px] border border-border-secondary bg-bg-elevated px-2.5 py-1.5 text-12 text-text-primary shadow-L3 fade-in", className)}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function hasDisabledControl(node: ReactNode, depth = 0): boolean {
  if (!isValidElement<{ disabled?: boolean; children?: ReactNode }>(node) || depth > 2) return false;
  if (node.props.disabled === true) return true;
  return hasDisabledControl(node.props.children, depth + 1);
}
