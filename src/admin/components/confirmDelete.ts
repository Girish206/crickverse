import Swal from "sweetalert2";

function themeColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Shared SweetAlert2 delete-confirmation dialog (a ported DMS "extra") used
// by every admin list's Delete action, themed from this app's CSS variables
// (src/admin/dms/index.css) rather than hardcoded colors. Pass the item's
// name so the dialog says exactly what's about to go.
export async function confirmDelete(itemLabel: string, itemName?: string): Promise<boolean> {
  const result = await Swal.fire({
    title: `Delete this ${itemLabel}?`,
    // Plain `text` (not `html`), so a name can't inject markup.
    text: itemName ? `"${itemName}" will be deleted. This can't be undone.` : "This can't be undone.",
    icon: "warning",
    theme: document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light",
    showCancelButton: true,
    confirmButtonColor: themeColor("--primary"),
    cancelButtonColor: themeColor("--muted-color"),
    confirmButtonText: "Yes, delete it",
  });
  return result.isConfirmed;
}

// Same themed dialog for non-destructive-but-significant actions (closing a
// savings goal or expense group) — confirm text supplied by the caller.
export async function confirmAction(title: string, text: string, confirmButtonText: string): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon: "question",
    theme: document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light",
    showCancelButton: true,
    confirmButtonColor: themeColor("--primary"),
    cancelButtonColor: themeColor("--muted-color"),
    confirmButtonText,
  });
  return result.isConfirmed;
}
