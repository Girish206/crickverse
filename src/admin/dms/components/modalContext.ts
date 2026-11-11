import { createContext, useContext } from "react";

// Lets content rendered inside a DefaultModal reach the modal's footer slot
// (to portal its action buttons there) and close the modal.
export type CloseVia = "close" | "back";

export interface ModalSlot {
  footer: HTMLElement | null;
  close: () => void;
  // Lets the content step in when the modal is about to close: the guard
  // returns true when it has handled the close itself. `via` is "close" for
  // the X, "back" for the backdrop, Escape, the phone's back button or
  // close() above. Only a BottomSheet supports it.
  guardClose?: (guard: ((via: CloseVia) => boolean) | null) => void;
  // Lets the content retitle the modal for a step of its own (null puts
  // the modal's own title back). Only a BottomSheet supports it.
  setHeading?: (heading: { title: string; subtitle?: string; icon?: string } | null) => void;
}

export const ModalContext = createContext<ModalSlot | null>(null);

export function useModalSlot() {
  return useContext(ModalContext);
}

// Id of the enclosing ModalForm, so a submit button portaled out of the
// <form> into the modal footer can still submit it via the `form` attribute.
export const FormIdContext = createContext<string | undefined>(undefined);
