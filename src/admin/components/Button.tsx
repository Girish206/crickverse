import type { ButtonHTMLAttributes } from "react";
import CustomButton from "../dms/components/CustomButton";

export type ButtonVariant = "primary" | "outline" | "danger-text" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

// Generic action button (e.g. a list page's "+ New" button that opens the
// DefaultModal), rendered through the ported DMS CustomButton.
export function Button({ variant = "primary", size, type = "button", className = "", children, ...rest }: ButtonProps) {
  if (variant === "link" || variant === "danger-text") {
    const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
    return (
      <button
        type={type}
        className={`btn btn-link ${sizeClass} ${variant === "danger-text" ? "text-danger" : ""} ${className}`.trim()}
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
      size={size}
      className={className}
      {...rest}
    >
      {children ?? null}
    </CustomButton>
  );
}
