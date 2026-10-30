import Swal from "sweetalert2";
import "./confirmDialog.css";

// Shared SweetAlert2 confirm dialogs (a ported DMS "extra"), styled by
// confirmDialog.css from this app's CSS variables: a soft icon badge, the
// title and text, then Cancel and the action side by side.
async function confirmDialog({
  title,
  text,
  confirmButtonText,
  icon,
  danger = false,
}: {
  title: string;
  text: string;
  confirmButtonText: string;
  icon: string;
  danger?: boolean;
}): Promise<boolean> {
  const result = await Swal.fire({
    title,
    // Plain `text` (not `html`), so a name can't inject markup.
    text,
    icon: danger ? "warning" : "question",
    iconHtml: `<i class="${icon}" aria-hidden="true"></i>`,
    theme: document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light",
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: danger,
    buttonsStyling: false,
    confirmButtonText,
    cancelButtonText: "Cancel",
    customClass: {
      container: "cv-confirm-backdrop",
      popup: `cv-confirm${danger ? " is-danger" : ""}`,
      icon: "cv-confirm-icon",
      title: "cv-confirm-title",
      htmlContainer: "cv-confirm-text",
      actions: "cv-confirm-actions",
      confirmButton: "cv-confirm-btn is-confirm",
      cancelButton: "cv-confirm-btn is-cancel",
    },
  });
  return result.isConfirmed;
}

// Every admin list's Delete action. Pass the item's name so the dialog says
// exactly what's about to go.
export function confirmDelete(itemLabel: string, itemName?: string): Promise<boolean> {
  return confirmDialog({
    title: `Delete this ${itemLabel}?`,
    text: itemName ? `"${itemName}" will be deleted. This can't be undone.` : "This can't be undone.",
    confirmButtonText: "Yes, delete it",
    icon: "fa-solid fa-trash-can",
    danger: true,
  });
}

// Non-destructive-but-significant actions (closing a savings goal, stopping
// scoring…) — the caller's words, and optionally an icon that fits.
export function confirmAction(
  title: string,
  text: string,
  confirmButtonText: string,
  icon = "fa-solid fa-circle-question",
): Promise<boolean> {
  return confirmDialog({ title, text, confirmButtonText, icon });
}
