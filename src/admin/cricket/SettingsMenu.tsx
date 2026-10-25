import { useState } from "react";
import { PageHeaderAction } from "../components/PageHeader";
import { BottomSheet } from "./BottomSheet";

export interface SettingsMenuItem {
  icon: string;
  label: string;
  // A smaller line under the label.
  description?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

// The header's settings (gear) button, opening its items in a sheet from the
// bottom. Picking one closes the sheet first (it may open its own); hidden
// when there's nothing to show.
export function SettingsMenu({ title = "Settings", items }: { title?: string; items: SettingsMenuItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <PageHeaderAction icon="fa-solid fa-gear" label={title} tour="settings" active={open} onClick={() => setOpen(true)} />
      {open && (
        <BottomSheet title={title} icon="fa-solid fa-gear" onClose={() => setOpen(false)}>
          <div className="cricket-settings-list">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`cricket-settings-item ${item.danger ? "is-danger" : ""}`.trim()}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                <i className={item.icon} aria-hidden="true"></i>
                <span>
                  {item.label}
                  {item.description && <small>{item.description}</small>}
                </span>
                {!item.danger && <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
