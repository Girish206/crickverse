import { useId, type FormEvent, type ReactNode } from "react";
import { FormIdContext } from "../dms/components/modalContext";

export interface ModalFormProps {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}

// Bare <form> used inside a DefaultModal — the modal chrome + title already
// provide the framing, and DMS's own InputComp/TextareaInput/SelectInput
// fields are fully self-styled, so no extra wrapper class is needed. Its id
// lets the SubmitButton (portaled into the modal footer) still submit it.
export function ModalForm({ onSubmit, children }: ModalFormProps) {
  const formId = useId();
  return (
    <FormIdContext.Provider value={formId}>
      <form id={formId} onSubmit={onSubmit} noValidate>
        {children}
      </form>
    </FormIdContext.Provider>
  );
}
