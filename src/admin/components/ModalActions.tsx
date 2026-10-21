import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalSlot } from "../dms/components/modalContext";

// Renders action buttons in the enclosing DefaultModal's footer (right-
// aligned); outside a modal they sit right-aligned under the content.
export function ModalActions({ children }: { children: ReactNode }) {
  const modal = useModalSlot();
  if (modal?.footer) return createPortal(children, modal.footer);
  return <div className="admin-form-actions">{children}</div>;
}
