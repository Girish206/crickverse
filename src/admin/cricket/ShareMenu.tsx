import { useState } from "react";
import { toast } from "sonner";
import { PageHeaderAction } from "../components/PageHeader";
import { avatarColorFor } from "./avatarColor";
import { BottomSheet } from "./BottomSheet";

// A "Share as image" row (fixtures / squad cards).
export interface ShareMenuItem {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}

interface LinkTile {
  icon: string;
  label: string;
  tone: string;
  onClick: () => void;
}

export interface ShareSheetProps {
  // The sheet's title, e.g. "Share tournament".
  heading: string;
  path: string;
  // What's shared, e.g. the tournament's name; the preview's name.
  title: string;
  // The message sent with the link.
  text: string;
  // The preview's picture (a logo); its initial on a colour without one.
  image?: string;
  items?: ShareMenuItem[];
  // A line under the preview, e.g. whether the link works signed out.
  note?: string;
}

// The header's Share button, opening ShareSheet.
export function ShareMenu(props: ShareSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeaderAction icon="fa-solid fa-share-nodes" label="Share" tour="share" active={open} onClick={() => setOpen(true)} />
      {open && <ShareSheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

// Inviting someone to the app itself (the menus' "Share RunMitra").
export function ShareAppSheet({ onClose }: { onClose: () => void }) {
  return (
    <ShareSheet
      heading="Share RunMitra"
      path="/"
      title="RunMitra"
      text="Score matches ball by ball, run tournaments and track your cricket stats on RunMitra. Join me:"
      image="/favicon.svg"
      onClose={onClose}
    />
  );
}

// A sheet from the bottom: a preview of what's shared (picture, name, link),
// tiles sending the link (WhatsApp, Telegram, copy, the phone's share
// sheet), then the page's image cards. A link opened signed out signs in
// first and comes back to the page (ProtectedRoute / AdminLoginPage).
export function ShareSheet({
  heading,
  path,
  title,
  text,
  image,
  items = [],
  note,
  onClose,
}: ShareSheetProps & { onClose: () => void }) {
  const url = new URL(path, window.location.origin).toString();
  const message = `${text}\n${url}`;
  const canShare = typeof navigator.share === "function";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Couldn't share the link");
    }
  }

  const openUrl = (href: string) => window.open(href, "_blank", "noopener");
  const tiles: LinkTile[] = [
    {
      icon: "fa-brands fa-whatsapp",
      label: "WhatsApp",
      tone: "is-whatsapp",
      onClick: () => openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`),
    },
    {
      icon: "fa-brands fa-telegram",
      label: "Telegram",
      tone: "is-telegram",
      onClick: () => openUrl(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`),
    },
    { icon: "fa-solid fa-link", label: "Copy link", tone: "is-copy", onClick: copyLink },
    canShare
      ? { icon: "fa-solid fa-ellipsis", label: "More", tone: "is-more", onClick: shareLink }
      : {
          icon: "fa-solid fa-envelope",
          label: "Email",
          tone: "is-more",
          onClick: () => openUrl(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`),
        },
  ];

  // Tiles and rows close the sheet first (an image card opens its own).
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <BottomSheet title={heading} icon="fa-solid fa-share-nodes" onClose={onClose}>
      <div className="cricket-share-preview">
        {image ? (
          <span className="cricket-share-preview-pic" style={{ backgroundImage: `url(${image})` }} aria-hidden="true" />
        ) : (
          <span className="cricket-share-preview-pic" style={{ background: avatarColorFor(title) }} aria-hidden="true">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="cricket-share-preview-text">
          <strong>{title}</strong>
          <small>{url.replace(/^https?:\/\//, "")}</small>
        </span>
        <button type="button" className="cricket-share-preview-copy" onClick={copyLink} aria-label="Copy link" title="Copy link">
          <i className="fa-regular fa-copy" aria-hidden="true"></i>
        </button>
      </div>

      {note && <p className="admin-hint cricket-share-note">{note}</p>}

      <h3 className="cricket-share-label">Send link</h3>
      <div className="cricket-share-tiles">
        {tiles.map((tile) => (
          <button key={tile.label} type="button" onClick={run(tile.onClick)}>
            <span className={tile.tone}>
              <i className={tile.icon} aria-hidden="true"></i>
            </span>
            {tile.label}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <>
          <h3 className="cricket-share-label">Share as image</h3>
          <div className="cricket-share-rows">
            {items.map((item) => (
              <button key={item.label} type="button" onClick={run(item.onClick)}>
                <span className="cricket-share-row-icon">
                  <i className={item.icon} aria-hidden="true"></i>
                </span>
                <span className="cricket-share-row-text">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <i className="fa-solid fa-chevron-right cricket-share-row-go" aria-hidden="true"></i>
              </button>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
