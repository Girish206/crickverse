import React, { useEffect, useState } from "react";
import "../css/components/InputComp.css";

interface TextInputProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size"
> {
    label?: string | React.ReactNode;
    icon?: string;
    iconPosition?: "left" | "right";
    floating?: boolean;
    inputSize?: "sm" | "md" | "lg";
    error?: string;
    className?: string;
    animatedPlaceholders?: string[];
    iconOnClick?: () => void;
}

const InputComp: React.FC<TextInputProps> = ({
    label,
    type = "text",
    icon,
    iconPosition = "right",
    id,
    value = "",
    name,
    error = "",
    className = "",
    placeholder = "",
    floating = false,
    required = false,
    readOnly = false,
    inputSize,
    animatedPlaceholders,
    onChange,
    iconOnClick = () => { },
    ...rest
}) => {
    const [dynamicCategory, setDynamicCategory] = useState("");
    const [catIndex, setCatIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    // ---- Animated placeholder ----
    useEffect(() => {
        if (!animatedPlaceholders?.length) return;

        const current = animatedPlaceholders[catIndex];
        const speed = isDeleting ? 40 : 80;

        const t = setTimeout(() => {
            if (!isDeleting) {
                setDynamicCategory(current.slice(0, charIndex + 1));
                setCharIndex((p) => p + 1);

                if (charIndex === current.length) {
                    setTimeout(() => setIsDeleting(true), 900);
                }
            } else {
                setDynamicCategory(current.slice(0, charIndex - 1));
                setCharIndex((p) => p - 1);

                if (charIndex === 0) {
                    setIsDeleting(false);
                    setCatIndex((p) => (p + 1) % animatedPlaceholders.length);
                }
            }
        }, speed);

        return () => clearTimeout(t);
    }, [charIndex, isDeleting, catIndex, animatedPlaceholders]);

    const sizeClass =
        inputSize === "sm"
            ? "form-control-sm"
            : inputSize === "lg"
                ? "form-control-lg"
                : "";

    const iconEl = icon && (
        <span
            onClick={iconOnClick}
            className={`input-icon ${iconPosition === "left" ? "input-icon-left" : "input-icon-right"
                }`}
        >
            <i className={icon} style={{ color: "#f97316" }}></i>
        </span>
    );

    /* ---------- Floating Mode ---------- */
    if (floating) {
        return (
            <div className="m-1">
                <div
                    className={`input-group-custom form-floating ${!label ? "no-label" : ""
                        } input-with-icon position-relative w-100`}
                >
                    <input
                        type={type}
                        className={`form-control custom-input ${sizeClass} ${className} ${icon
                                ? iconPosition === "left"
                                    ? "pl-icon"
                                    : "pr-icon"
                                : ""
                            }`}
                        id={id}
                        name={name}
                        // For floating WITH label: space keeps :placeholder-shown working.
                        // For no-label: use the real placeholder so it's always visible.
                        placeholder={label ? " " : placeholder || " "}
                        readOnly={readOnly}
                        value={value || ""}
                        onChange={onChange}
                        required={required}
                        {...rest}
                        autoComplete="chrome-off"
                    />
                    {label && (
                        <label htmlFor={id || name}>
                            {label}
                            {required && (
                                <span className="text-theme-primary">
                                    &nbsp;*
                                </span>
                            )}
                        </label>
                    )}
                    {iconEl}
                </div>
                {error && (
                    <small className="text-theme-primary ms-1">{error}</small>
                )}
            </div>
        );
    }

    /* ---------- Normal Mode ---------- */
    return (
        <div className="m-1">
            {label && (
                <label
                    className="pb-0 ps-1 form-control-label"
                    htmlFor={id || name}
                >
                    {label}
                    {required && (
                        <span className="text-theme-primary">&nbsp;*</span>
                    )}
                </label>
            )}
            <div className="input-group-custom input-with-icon position-relative w-100">
                <input
                    type={type}
                    className={`form-control custom-input ${sizeClass} ${className} ${icon
                            ? iconPosition === "left"
                                ? "pl-icon"
                                : "pr-icon"
                            : ""
                        }`}
                    id={id}
                    name={name}
                    placeholder={
                        animatedPlaceholders
                            ? `Search ${dynamicCategory}`
                            : placeholder
                    }
                    readOnly={readOnly}
                    value={value || ""}
                    onChange={onChange}
                    required={required}
                    {...rest}
                    autoComplete="chrome-off"
                />
                {iconEl}
            </div>
            {error && <small className="text-theme-primary">{error}</small>}
        </div>
    );
};

export default InputComp;
