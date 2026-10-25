import "./BrandSignature.css";

// "DESIGNED & BUILT BY" between two fading hairlines, then the Girish
// Creations bulb logo and name. Full size on the sign-in screen's dark
// backdrop; `small` in the phone menu drawer, in the theme's colours.
export function BrandSignature({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand-signature ${small ? "brand-signature-sm" : "brand-signature-on-dark"}`}>
      <span className="brand-signature-by">Designed &amp; built by</span>
      <span className="brand-signature-brand">
        <img src="/girish-creations-logo.png" alt="" className="brand-signature-logo" />
        <span className="brand-signature-name">Girish Creations</span>
      </span>
    </div>
  );
}
