import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full min-w-0 rounded-[6px] border border-border-secondary bg-bg-elevated px-2.5 py-1.5 text-13 text-text-primary outline-none placeholder:text-text-disabled focus-visible:border-border-primary focus-visible:ring-2 focus-visible:ring-border-secondary disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "resize-none", className)} {...props} />;
});
