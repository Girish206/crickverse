import React from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import "../css/components/SelectInput.css";

interface Option {
    value: any;
    label: any;
}

interface SelectProps {
    options?: Option[];
    label?: string | React.ReactNode;
    id?: string;
    value?: any;
    name?: string;
    error?: string;
    isMulti?: boolean;
    required?: boolean;
    readOnly?: boolean;
    clearable?: boolean;
    placeholder?: string;
    onChange: (value: any) => void;
    className?: string;
    floating?: boolean;
    size?: "sm" | "md" | "lg";
    creatable?: boolean;
    isLoading?: boolean;
}

const SelectInput: React.FC<SelectProps> = ({
    options = [],
    label = "",
    id = "",
    value = "",
    name = "",
    error = "",
    isMulti = false,
    required = false,
    readOnly = false,
    clearable = true,
    placeholder = "",
    onChange,
    className = "",
    // Floating labels are the app-wide default (compact underline fields).
    floating = true,
    size = "md",
    creatable = false,
    isLoading = false,
}) => {
    const sizeClass = `select-${size}`;
    const [isFocused, setIsFocused] = React.useState(false);

    const hasValue = isMulti
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== "";

    const isLabelFloating = isFocused || hasValue;

    // Shared react-select props
    const sharedProps = {
        name,
        inputId: id,
        classNamePrefix: "select",
        className: floating ? "select-floating" : "",
        // In floating mode: always use a space so the control never looks empty
        // when there's no real placeholder needed (label covers it).
        // In normal mode: use the real placeholder.
        placeholder: floating ? (isFocused ? placeholder : " ") : placeholder,
        options,
        isClearable: clearable,
        isMulti,
        isLoading,
        menuPosition: "absolute" as const,
        menuPlacement: "auto" as const,
        onFocus: () => setIsFocused(true),
        onBlur: () => setIsFocused(false),
        styles: {
            menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
        },
        menuPortalTarget: document.body,
        isDisabled: readOnly,
    };

    const resolvedValue = isMulti
        ? options.filter(
            (option) =>
                Array.isArray(value) && value.includes(option.value),
        )
        : options.find(
            (option) =>
                option?.value?.toString() === value?.toString(),
        ) ||
        (value && typeof value !== "object"
            ? {
                value,
                label: isNaN(Number(value)) ? value : "Loading...",
            }
            : null);

    const creatableValue = isMulti
        ? Array.isArray(value)
            ? value.map(
                (val) =>
                    options.find((opt) => opt.value === val) || {
                        label: val,
                        value: val,
                    },
            )
            : []
        : options.find(
            (opt) => opt?.value?.toString() === value?.toString(),
        ) ||
        (value && typeof value !== "object"
            ? { label: value, value }
            : null);

    const handleChange = (selected: any) => {
        if (isMulti) {
            onChange((selected as Option[] | null)?.map((opt) => opt.value) || []);
        } else {
            onChange((selected as Option | null)?.value || "");
        }
    };

    return (
        <div className={`m-1 text-start ${className}`}>
            <div
                className={`${sizeClass} ${floating ? "form-floating" : ""
                    } select-wrapper`}
            >
                {/* Normal mode label */}
                {!floating && label && (
                    <label htmlFor={id} className="pb-0 ps-1 select-label">
                        {typeof label === "string" ? (
                            <span dangerouslySetInnerHTML={{ __html: label }} />
                        ) : (
                            label
                        )}
                        {required && (
                            <span className="text-theme-primary">&nbsp;*</span>
                        )}
                    </label>
                )}

                {creatable ? (
                    <CreatableSelect
                        {...sharedProps}
                        value={creatableValue}
                        onChange={handleChange}
                        formatCreateLabel={(inputValue) =>
                            `Add "${inputValue}"`
                        }
                    />
                ) : (
                    <Select
                        {...sharedProps}
                        value={resolvedValue}
                        onChange={handleChange}
                    />
                )}

                {/* Floating mode label */}
                {floating && label && (
                    <label
                        htmlFor={id}
                        className={`select-floating-label ${isLabelFloating ? "floating-label-active" : ""
                            }`}
                    >
                        {typeof label === "string" ? (
                            <span dangerouslySetInnerHTML={{ __html: label }} />
                        ) : (
                            label
                        )}
                        {required && (
                            <span className="text-theme-primary">&nbsp;*</span>
                        )}
                    </label>
                )}
            </div>
            {error && (
                <small className="text-theme-primary ms-1">{error}</small>
            )}
        </div>
    );
};

export default SelectInput;
