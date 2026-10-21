interface TextInputProps {
  label?: string;
  icon?: string;
  id?: string;
  value?: any;
  name?: string;
  error?: string;
  className?: string;
  placeholder?: string;
  floating?: boolean;
  required?: boolean;
  readOnly?: boolean;
  rows?: number;
  onChange: (e: any) => void;
}

const TextareaInput: React.FC<TextInputProps> = ({
  label = "",
  id = "",
  value = "",
  name = "",
  error = "",
  className = "",
  placeholder = "",
  floating = false,
  required = false,
  readOnly = false,
  rows = 1,
  onChange,
}) => {
  return (
    <div
      className={`${
        !floating ? "mt-2 mb-2 ms-1 me-1" : "mt-1 mb-1 ms-1 me-1"
      } ${
        floating
          ? "form-floating position-relative input-group-custom"
          : ""
      } `}
    >
      {!floating && label && (
        <label className="pb-0 ps-1" htmlFor={id}>
          <span dangerouslySetInnerHTML={{ __html: label }} />{" "}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      <textarea
        className={`form-control custom-input ${className}`}
        id={id}
        name={name}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value || ""}
        onChange={onChange}
        rows={rows}
      />
      {floating && label && (
        <label htmlFor={id}>
          <span dangerouslySetInnerHTML={{ __html: label }} />{" "}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      {error && <small className="text-danger">{error}</small>}
    </div>
  );
};

export default TextareaInput;
