import React from "react";
import "../css/components/Button.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "normal" | "outline";
    size?: "sm" | "lg" | "md";
    rounded?: boolean;
    children: React.ReactNode;
    bg?: string;
    type?: "button" | "submit" | "reset";
    loading?: boolean;
    loadingLabel?: string;
}

const CustomButton: React.FC<ButtonProps> = ({
    variant = "normal",
    size = "md",
    rounded = false,
    children,
    className = "",
    bg = "custom-primary",
    type = "button",
    loading = false,
    loadingLabel = "Loading...",
    disabled,
    ...props
}) => {
    const variantClass =
        variant === "outline" ? `btn-outline-${bg}` : `btn-${bg}`;
    const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
    const roundedClass = rounded ? "btn-rounded" : "";

    return (
        <button
            type={type}
            className={`btn ${variantClass} ${sizeClass} ${roundedClass} ${className} m-1`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                    ></span>
                    {loadingLabel}
                </>
            ) : (
                children
            )}
        </button>
    );
};

export default CustomButton;
