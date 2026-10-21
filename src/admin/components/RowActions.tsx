import type { ReactNode } from "react";
import CustomButton from "../dms/components/CustomButton";
import "./RowActions.css";

export interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  children?: ReactNode;
}

// The View/Edit/Delete action set repeated on every admin list item — a
// VirtualTable "Actions" cell (Contact Messages), a timeline card header
// (Experience/Education), or a card-grid item (Certifications/Skills/
// Tools/Projects/Blog). Icon-only circular buttons in the logo colours
// (view = navy, edit = orange, delete = crimson — see RowActions.css). View opens
// a read-only DetailView modal with every field (the card/row itself only
// shows a truncated summary); Edit opens that row's record in the shared
// DefaultModal form (see the owning List component) rather than navigating
// to a separate page.
export function RowActions({ onView, onEdit, onDelete, deleteLabel = "Delete", children }: RowActionsProps) {
  return (
    <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {children}
      {onView && (
        <CustomButton
          size="sm"
          bg="info"
          rounded
          className="m-0 admin-row-action-btn"
          onClick={onView}
          title="View"
          aria-label="View"
        >
          <i className="fa-solid fa-eye" aria-hidden="true"></i>
        </CustomButton>
      )}
      {onEdit && (
        <CustomButton
          size="sm"
          bg="success"
          rounded
          className="m-0 admin-row-action-btn"
          onClick={onEdit}
          title="Edit"
          aria-label="Edit"
        >
          <i className="fa-solid fa-pen" aria-hidden="true"></i>
        </CustomButton>
      )}
      {onDelete && (
        <CustomButton
          size="sm"
          bg="danger"
          rounded
          className="m-0 admin-row-action-btn"
          onClick={onDelete}
          title={deleteLabel}
          aria-label={deleteLabel}
        >
          <i className="fa-solid fa-trash" aria-hidden="true"></i>
        </CustomButton>
      )}
    </div>
  );
}
