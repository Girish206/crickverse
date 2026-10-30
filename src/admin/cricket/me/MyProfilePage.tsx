import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCricketMe, useSetMyPhoto, useUpdateMyProfile } from "../../../api/hooks/cricket/useCricketPlayers";
import { PUSH_BLOCKER_TEXT, PushSetupError, useCricketPush } from "../../../api/hooks/cricket/useCricketPush";
import type { CricketMe, CricketPlayer, CricketPlayerRole } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { compressImage, MAX_UPLOAD_BYTES, PLAYER_PHOTO } from "../../../utils/compressImage";
import { PageHeader } from "../../components/PageHeader";
import CustomButton from "../../dms/components/CustomButton";
import InputComp from "../../dms/components/InputComp";
import { ChipChoice } from "../CricketChoices";
import { formatMobile, normalizeMobile } from "../mobile";
import { PLAYER_ROLES, roleOf } from "../playerRoles";
import { setTipsOff, tipsOff } from "../TipsTour";
import { ShareAppSheet } from "../ShareMenu";
import { SettingsMenu } from "../SettingsMenu";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerQrSheet } from "../qr/ShowQrSheets";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import "./MyProfilePage.css";
import { Loader } from "../../components/Loader";
import { confirmAction } from "../../components/confirmDelete";

// /profile — the signed-in user's own details: photo, name, mobile number
// (also their sign-in), playing role and password; sharing, notifications,
// tips and signing out are under the header's ⚙.
export function MyProfilePage() {
  const { data: me } = useCricketMe();

  return (
    <div className="cricket-page cv-profile">
      <PageHeader title="My Profile" subtitle="Account" actions={<ProfileSettings player={me?.player ?? null} />} />
      {me ? (
        <ProfileForm me={me} />
      ) : (
        <div className="card cv-profile-card">
          <Loader />
        </div>
      )}
    </div>
  );
}

function ProfileForm({ me }: { me: CricketMe }) {
  const { admin, applyToken } = useAdminAuth();
  const updateProfile = useUpdateMyProfile();
  const setPhoto = useSetMyPhoto();
  const player = me.player;

  const [name, setName] = useState(player?.name ?? admin?.name ?? "");
  const [mobile, setMobile] = useState(me.accountMobile ? formatMobile(me.accountMobile) : "");
  const [role, setRole] = useState<CricketPlayerRole | null>(player?.role ?? null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  const displayName = name.trim() || admin?.name || "?";
  // The saved role, not the one being picked below.
  const savedRole = roleOf(player?.role ?? null);

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) return setPhotoError("Choose an image file.");
    let file: File;
    try {
      file = await compressImage(picked, PLAYER_PHOTO);
    } catch (err) {
      return setPhotoError((err as Error).message);
    }
    if (file.size > MAX_UPLOAD_BYTES) return setPhotoError("This photo is too large. Try a smaller one.");
    setPhotoError(null);
    // A failed upload shows the app's usual error toast.
    setPhoto.mutate(file);
  }

  function validate() {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your name";
    if (!normalizeMobile(mobile)) next.mobile = "Enter a valid 10-digit mobile number";
    if (newPassword || currentPassword || confirmPassword) {
      if (!currentPassword) next.currentPassword = "Enter your current password";
      if (newPassword.length < 8) next.newPassword = "Use at least 8 characters";
      if (confirmPassword !== newPassword) next.confirmPassword = "The passwords don't match";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const token = await updateProfile.mutateAsync({
      name: name.trim(),
      mobile: normalizeMobile(mobile)!,
      role,
      ...(newPassword ? { currentPassword, newPassword } : {}),
    });
    applyToken(token);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success(newPassword ? "Profile and password updated" : "Profile updated");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="cv-profile-form">
      {/* The Home hero: who they are on the left; the photo (tap to change)
          on the right, with Remove photo under it. */}
      <section className="cricket-home-hero cv-profile-hero">
        <div className="cricket-home-hero-top">
          <div className="cricket-home-hero-name cv-profile-id">
            <small>{admin?.isSuperAdmin ? "Organiser" : "Player"}</small>
            <h2>{displayName}</h2>
            {savedRole && <span className="cv-profile-role">{savedRole.label}</span>}
          </div>
          <div className="cv-profile-photo-col">
            <label className={`cv-profile-photo ${player ? "" : "is-disabled"}`.trim()}>
              {player && <input type="file" accept="image/*" hidden onChange={pickPhoto} disabled={setPhoto.isPending} />}
              <PlayerAvatar
                name={displayName}
                photoUrl={player?.photoUrl}
                className="cricket-player-avatar cricket-home-hero-avatar cv-profile-avatar"
              />
              {player && (
                <span className="cv-profile-cam" aria-hidden="true">
                  <i className={`fa-solid ${setPhoto.isPending ? "fa-spinner fa-spin" : "fa-camera"}`}></i>
                </span>
              )}
            </label>
            {player?.photoUrl && (
              <button
                type="button"
                className="cv-profile-remove"
                disabled={setPhoto.isPending}
                onClick={() => setPhoto.mutate(null)}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </section>
      {photoError && <div className="admin-banner admin-banner-error">{photoError}</div>}

      <section className="card cv-profile-card">
        <h3 className="cv-profile-section">
          <i className="fa-solid fa-user" aria-hidden="true"></i> Personal details
        </h3>
        <InputComp
          label="Full name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          error={errors.name}
        />
        <InputComp
          label="Mobile number"
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
          error={errors.mobile}
        />
        <small className="admin-hint d-block ms-1 mb-2">
          You sign in with this number — changing it changes your sign-in too.
        </small>
        {player && (
          <ChipChoice
            label="Playing role"
            options={PLAYER_ROLES.map((r) => ({ value: r.value, label: r.label }))}
            value={role}
            onChange={setRole}
          />
        )}
      </section>

      <section className="card cv-profile-card">
        <h3 className="cv-profile-section">
          <i className="fa-solid fa-lock" aria-hidden="true"></i> Change password
        </h3>
        <p className="admin-hint mb-2">Leave these empty to keep your current password.</p>
        <InputComp
          label="Current password"
          name="currentPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          icon={`fa-solid ${showPasswords ? "fa-eye" : "fa-eye-slash"}`}
          iconPosition="right"
          iconOnClick={() => setShowPasswords((prev) => !prev)}
          error={errors.currentPassword}
        />
        <InputComp
          label="New password"
          name="newPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
        />
        <InputComp
          label="Confirm new password"
          name="confirmPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />
      </section>

      <div className="cv-profile-actions">
        <CustomButton
          type="submit"
          rounded
          className="w-100"
          loading={updateProfile.isPending}
          loadingLabel="Saving..."
        >
          <i className="fa-solid fa-check me-2" aria-hidden="true"></i>Save changes
        </CustomButton>
      </div>
    </form>
  );
}

// The header's ⚙: their QR code, sharing the app, this device's
// notifications, tips and signing out — everything on the page but the form
// and its Save.
function ProfileSettings({ player }: { player: CricketPlayer | null }) {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [sharingApp, setSharingApp] = useState(false);
  const [showingQr, setShowingQr] = useState(false);
  const [noTips, setNoTips] = useState(tipsOff);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  // A lost phone, or a shared one: ends every session of the account.
  async function handleLogoutEverywhere() {
    const confirmed = await confirmAction(
      "Sign out of all devices?",
      "You'll need your password to sign in again on every phone and computer, including this one.",
      "Sign out everywhere",
    );
    if (!confirmed) return;
    try {
      await logout({ everywhere: true });
      navigate("/login", { replace: true });
    } catch {
      toast.error("Couldn't sign out everywhere. Check your connection and try again.");
    }
  }

  return (
    <>
      <SettingsMenu
        items={[
          ...(player
            ? [
                {
                  icon: "fa-solid fa-qrcode",
                  label: "My QR code",
                  description: "Organisers scan it to add you to a team or as a scorer",
                  onClick: () => setShowingQr(true),
                },
              ]
            : []),
          {
            icon: "fa-solid fa-share-nodes",
            label: "Share RunMitra",
            description: "Send the app to friends",
            onClick: () => setSharingApp(true),
          },
          {
            icon: "fa-solid fa-lightbulb",
            label: noTips ? "Turn tips on" : "Turn tips off",
            description: noTips ? "Show the tips on each screen again" : "Stop showing tips on each screen",
            onClick: () => {
              setTipsOff(!noTips);
              setNoTips(!noTips);
              toast.success(noTips ? "Tips will show again on each screen" : "Tips turned off");
            },
          },
          {
            icon: "fa-solid fa-shield-halved",
            label: "Sign out of all devices",
            description: "Every phone and computer, including this one",
            onClick: handleLogoutEverywhere,
          },
          { icon: "fa-solid fa-right-from-bracket", label: "Sign out", onClick: handleLogout, danger: true },
        ]}
      >
        <NotificationsRow />
      </SettingsMenu>
      {sharingApp && <ShareAppSheet onClose={() => setSharingApp(false)} />}
      {showingQr && player && <PlayerQrSheet player={player} onClose={() => setShowingQr(false)} />}
    </>
  );
}

// "Match notifications": this browser's push switch. When it can't work
// here (no service worker in dev, no server key, blocked) the line under it
// says why instead.
function NotificationsRow() {
  const push = useCricketPush();
  const blocked = push.blocker !== null && !push.on;
  const note = blocked
    ? PUSH_BLOCKER_TEXT[push.blocker!]
    : push.onElsewhere
      ? "On for another of your devices — turn it on here too."
      : "Hear when your matches — and the ones you follow — start and finish.";

  function toggle() {
    if (push.busy) return;
    if (push.on) {
      push.disable.mutate(undefined, {
        onSuccess: () => toast.success("Match notifications off on this device"),
        onError: () => toast.error("Turned off here, but couldn't tell the server. It'll stop sending soon."),
      });
    } else {
      push.enable.mutate(undefined, {
        onSuccess: () => toast.success("Match notifications on — we've sent you a test one"),
        onError: (error) =>
          toast.error(error instanceof PushSetupError ? error.message : "Couldn't turn notifications on. Try again."),
      });
    }
  }

  return (
    <label className={`cv-profile-switch${blocked ? " is-blocked" : ""}`}>
      <i className="fa-solid fa-bell" aria-hidden="true"></i>
      <span className="cv-profile-switch-text">
        <strong>Match notifications</strong>
        <small>{note}</small>
      </span>
      <span className="form-check form-switch m-0">
        <input
          type="checkbox"
          role="switch"
          className="form-check-input"
          checked={push.on}
          disabled={!push.ready || push.busy || blocked}
          onChange={toggle}
          aria-label="Match notifications"
        />
      </span>
    </label>
  );
}
