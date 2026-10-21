import { useContext, type ButtonHTMLAttributes } from "react";
import CustomButton from "../dms/components/CustomButton";
import { FormIdContext, useModalSlot } from "../dms/components/modalContext";
import { ModalActions } from "./ModalActions";

export interface SubmitButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  loading?: boolean;
  loadingLabel?: string;
}

// The form-submit button used at the bottom of every admin form, rendered
// through the ported DMS CustomButton so it picks up the theme's --primary
// color. Inside a DefaultModal it moves into the modal's footer, right-aligned
// next to a Cancel button; elsewhere it sits right-aligned under the form.
export function SubmitButton({
  loading = false,
  loadingLabel = "Saving...",
  children,
  className = "",
  disabled,
  ...rest
}: SubmitButtonProps) {
  const modal = useModalSlot();
  const formId = useContext(FormIdContext);

  const submit = (
    <CustomButton
      type="submit"
      form={formId}
      className={`admin-form-submit ${className}`.trim()}
      disabled={disabled}
      loading={loading}
      loadingLabel={loadingLabel}
      {...rest}
    >
      {children}
    </CustomButton>
  );

  return (
    <ModalActions>
      {modal && (
        <CustomButton bg="custom-secondary" onClick={modal.close} disabled={loading}>
          Cancel
        </CustomButton>
      )}
      {submit}
    </ModalActions>
  );
}
