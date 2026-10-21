import type { ButtonHTMLAttributes } from "react";
import CustomButton from "../dms/components/CustomButton";

export type ButtonVariant = "primary" | "outline" | "danger-text" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Generic action button (e.g. a list page's "+ New" button that opens the
// DefaultModal), rendered through the ported DMS CustomButton.
export function Button({ variant = "primary", type = "button", className = "", children, ...rest }: ButtonProps) {
  if (variant === "link" || variant === "danger-text") {
    return (
      <button
        type={type}
        className={`btn btn-link ${variant === "danger-text" ? "text-danger" : ""} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  }
  return (
    <CustomButton
      type={type}
      variant={variant === "outline" ? "outline" : "normal"}
      className={className}
      {...rest}
    >
      {children ?? null}
    </CustomButton>
  );
}
