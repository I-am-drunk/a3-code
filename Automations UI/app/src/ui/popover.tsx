import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<HTMLDivElement, PopoverPrimitive.PopoverContentProps>(function PopoverContent(
  { className, align = "start", sideOffset = 4, ...props }, ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn("z-[70] rounded-[8px] border border-border-secondary bg-bg-elevated p-2 text-text-primary shadow-L3 outline-none menu-in", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
