import type { ReactNode } from "react";
import { fieldErrorId, fieldHintId } from "@/features/auth/lib/fieldAria";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
  labelAside?: ReactNode;
  hint?: string;
  error?: string;
}

export function FormField({ label, htmlFor, children, labelAside, hint, error }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={fieldErrorId(htmlFor)} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={fieldHintId(htmlFor)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
