import { avatarColorFor } from "./avatarColor";

// Who to contact about a match or tournament: the organiser's name and
// number, with one-tap call, WhatsApp and email buttons (10-digit numbers are
// taken as Indian for WhatsApp).
export function OrganiserCard({
  name,
  mobile,
  email,
}: {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
}) {
  const label = name || "Organiser";
  const digits = mobile?.replace(/\D/g, "") ?? "";
  const whatsapp = digits.length === 10 ? `91${digits}` : digits;
  return (
    <div className="cricket-organiser">
      <span className="cricket-organiser-avatar" style={{ background: avatarColorFor(label) }} aria-hidden="true">
        {label.charAt(0).toUpperCase()}
      </span>
      <div className="cricket-organiser-text">
        <span>Organised by</span>
        <strong>{label}</strong>
        {(mobile || email) && <small>{mobile || email}</small>}
      </div>
      {(mobile || email) && (
        <div className="cricket-organiser-actions">
          {mobile && (
            <a href={`tel:${mobile}`} className="cricket-organiser-btn" aria-label={`Call ${label}`}>
              <i className="fa-solid fa-phone" aria-hidden="true"></i>
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="cricket-organiser-btn is-whatsapp"
              aria-label={`WhatsApp ${label}`}
            >
              <i className="fa-brands fa-whatsapp" aria-hidden="true"></i>
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="cricket-organiser-btn" aria-label={`Email ${label}`}>
              <i className="fa-solid fa-envelope" aria-hidden="true"></i>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
