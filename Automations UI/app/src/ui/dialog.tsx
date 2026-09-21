import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className, children, hideClose, title, description, footer, onInteractOutside,
}: {
  className?: string; children?: ReactNode; hideClose?: boolean; title?: ReactNode; description?: ReactNode; footer?: ReactNode;
  onInteractOutside?: (e: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-bg-scrim fade-in" />
      <DialogPrimitive.Content
        onInteractOutside={onInteractOutside}
        className={cn(
          "fixed left-1/2 top-1/2 z-[81] flex w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[12px] border border-border-secondary bg-bg-elevated p-5 text-text-primary shadow-L4 outline-none menu-in",
          className,
        )}
      >
        {(title || description) && (
          <div className="flex flex-col gap-1.5 pr-6">
            {title && <DialogPrimitive.Title className="text-15 font-semibold leading-[20px] text-text-primary">{title}</DialogPrimitive.Title>}
            {description ? (
              <DialogPrimitive.Description className="text-13 text-text-secondary">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : ""}</DialogPrimitive.Description>
            )}
          </div>
        )}
        {children}
        {footer && <div className="flex items-center justify-end gap-2">{footer}</div>}
        {!hideClose && (
          <DialogPrimitive.Close asChild>
            <button aria-label="Close" className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-[6px] text-text-secondary hover:bg-tint-secondary hover:text-text-primary focus-ring">
              <X size={14} />
            </button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Destructive/confirm dialog used by delete / discard / regenerate / disable-network. */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel = "Cancel", onConfirm, confirmVariant = "destructive",
  hideClose, loading, children, confirmDisabled,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; confirmLabel: string;
  cancelLabel?: string; onConfirm: () => void; confirmVariant?: ButtonVariant; hideClose?: boolean; loading?: boolean;
  children?: ReactNode; confirmDisabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose={hideClose}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
            <Button variant={confirmVariant} onClick={onConfirm} disabled={loading || confirmDisabled}>{confirmLabel}</Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
