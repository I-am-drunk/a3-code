import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Dark anchored popover menus with selected-row checkmarks (Appendix E “Observable
 * interaction and visual system”). Items are 30px rows, 13px text, 6px radius.
 */
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuSub = Menu.Sub;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <Menu.Separator className={cn("my-1 h-px bg-border-secondary", className)} />
);

export const menuContentClass =
  "z-[70] min-w-[180px] rounded-[8px] border border-border-secondary bg-bg-elevated p-1 text-text-primary shadow-L3 outline-none menu-in";
export const menuItemClass =
  "relative flex h-[30px] cursor-default select-none items-center gap-2 rounded-[6px] px-2.5 text-13 text-text-primary outline-none data-[highlighted]:bg-tint-secondary data-[disabled]:pointer-events-none data-[disabled]:text-text-disabled [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-text-secondary";

export const DropdownMenuContent = forwardRef<HTMLDivElement, Menu.DropdownMenuContentProps>(function DropdownMenuContent(
  { className, sideOffset = 4, align = "end", ...props }, ref,
) {
  return (
    <Menu.Portal>
      <Menu.Content ref={ref} sideOffset={sideOffset} align={align} className={cn(menuContentClass, className)} {...props} />
    </Menu.Portal>
  );
});

export const DropdownMenuItem = forwardRef<HTMLDivElement, Menu.DropdownMenuItemProps & { inset?: boolean; variant?: "default" | "destructive" }>(function DropdownMenuItem(
  { className, inset, variant = "default", ...props }, ref,
) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(menuItemClass, inset && "pl-8", variant === "destructive" && "text-text-destructive data-[highlighted]:bg-tint-red data-[highlighted]:text-text-destructive [&_svg]:text-text-destructive", className)}
      {...props}
    />
  );
});

export const DropdownMenuSubTrigger = forwardRef<HTMLDivElement, Menu.DropdownMenuSubTriggerProps>(function DropdownMenuSubTrigger(
  { className, children, ...props }, ref,
) {
  return (
    <Menu.SubTrigger ref={ref} className={cn(menuItemClass, "data-[state=open]:bg-tint-secondary", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto !size-3.5" />
    </Menu.SubTrigger>
  );
});

export const DropdownMenuSubContent = forwardRef<HTMLDivElement, Menu.DropdownMenuSubContentProps>(function DropdownMenuSubContent(
  { className, sideOffset = 6, ...props }, ref,
) {
  return (
    <Menu.Portal>
      <Menu.SubContent ref={ref} sideOffset={sideOffset} alignOffset={-5} className={cn(menuContentClass, "min-w-[200px]", className)} {...props} />
    </Menu.Portal>
  );
});

export function DropdownMenuCheckItem({
  checked, children, className, ...props
}: Menu.DropdownMenuItemProps & { checked?: boolean; children: ReactNode }) {
  return (
    <Menu.Item className={cn(menuItemClass, "pr-8", className)} {...props}>
      {children}
      {checked && <Check className="absolute right-2.5 !size-4 !text-text-primary" />}
    </Menu.Item>
  );
}

export const DropdownMenuLabel = ({ className, ...props }: Menu.DropdownMenuLabelProps) => (
  <Menu.Label className={cn("px-2.5 pb-1 pt-1.5 text-12 font-medium uppercase text-text-secondary", className)} {...props} />
);
