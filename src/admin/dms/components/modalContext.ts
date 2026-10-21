import { createContext, useContext } from "react";

// Lets content rendered inside a DefaultModal reach the modal's footer slot
// (to portal its action buttons there) and close the modal.
export interface ModalSlot {
  footer: HTMLElement | null;
  close: () => void;
}

export const ModalContext = createContext<ModalSlot | null>(null);

export function useModalSlot() {
  return useContext(ModalContext);
}

// Id of the enclosing ModalForm, so a submit button portaled out of the
// <form> into the modal footer can still submit it via the `form` attribute.
export const FormIdContext = createContext<string | undefined>(undefined);
