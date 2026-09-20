import type { ReactNode } from "react";

import type {
  AccessibleButtonProps,
  AccessibleFormFieldProps,
  AccessibleIconButtonProps,
  AccessibleLoadingSpinnerProps,
  AccessibleProgressBarProps,
} from "@/lib/accessibility";

/**
 * Accessible form field component
 */
export function AccessibleFormField({
  id,
  label,
  error,
  hint,
  required,
  children,
}: AccessibleFormFieldProps & { children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="text-xs text-destructive mt-1"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Accessible table with proper ARIA structure
 */
export function AccessibleTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: Array<{ key: string; label: string }>;
  rows: Array<Record<string, ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className="text-left p-2 font-semibold"
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {headers.map((header) => (
                <td key={`${idx}-${header.key}`} className="p-2">
                  {row[header.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Accessible loading indicator
 */
export function AccessibleLoadingSpinner({
  label = "Loading",
}: AccessibleLoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className="flex items-center gap-2"
    >
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Accessible progress bar
 */
export function AccessibleProgressBar({
  value,
  max = 100,
  label,
}: AccessibleProgressBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div
        className="relative h-2 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || "Progress"}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{Math.round(percentage)}%</p>
    </div>
  );
}

export function SkipToMainContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );
}

/**
 * Accessible button component
 */
export function AccessibleButton({
  children,
  ariaLabel,
  ariaPressed,
  disabled,
  ...props
}: AccessibleButtonProps) {
  return (
    <button
      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Accessible icon button
 */
export function AccessibleIconButton({
  icon: Icon,
  label,
  ...props
}: AccessibleIconButtonProps) {
  return (
    <button
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label={label}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}
