import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Variant & Size Definitions                                                 */
/* -------------------------------------------------------------------------- */

const VARIANTS = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:opacity-90 focus-visible:ring-primary",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:opacity-90 focus-visible:ring-secondary",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted focus-visible:ring-primary",
  ghost:
    "bg-transparent text-foreground hover:bg-muted focus-visible:ring-primary",
  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 focus-visible:ring-destructive",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-lg gap-2.5",
  icon: "h-10 w-10 rounded-lg",
} as const;

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. @default "primary" */
  variant?: ButtonVariant;
  /** Size preset. @default "md" */
  size?: ButtonSize;
  /** Show loading spinner and disable interaction. */
  isLoading?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Button
 * ------
 * Composable, accessible button component built with Tailwind CSS.
 * Supports multiple variants, sizes, loading state, and ref forwarding.
 *
 * @example
 *   <Button variant="primary" size="md">Get Started</Button>
 *   <Button variant="outline" size="sm" isLoading>Saving…</Button>
 *   <Button variant="ghost" size="icon" aria-label="Menu">☰</Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center font-medium",
          "transition-all duration-150 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          // Variant + Size
          VARIANTS[variant],
          SIZES[size],
          // Custom overrides
          className,
        )}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
