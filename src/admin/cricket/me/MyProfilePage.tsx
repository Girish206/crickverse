import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCricketMe, useSetMyPhoto, useUpdateMyProfile } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMe, CricketPlayerRole } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { compressImage, MAX_UPLOAD_BYTES, PLAYER_PHOTO } from "../../../utils/compressImage";
import { PageHeader } from "../../components/PageHeader";
import CustomButton from "../../dms/components/CustomButton";
import InputComp from "../../dms/components/InputComp";
import { ChipChoice } from "../CricketChoices";
import { formatMobile, normalizeMobile } from "../mobile";
import { PLAYER_ROLES } from "../playerRoles";
import { PlayerAvatar } from "../players/PlayerAvatar";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import "./MyProfilePage.css";
import { Loader } from "../../components/Loader";

// /profile — the signed-in user's own details: photo, name, mobile number
// (also their sign-in), playing role and password, plus signing out.
export function MyProfilePage() {
  const { data: me } = useCricketMe();

  return (
    <div className="cricket-page cv-profile">
      <PageHeader title="My Profile" subtitle="Account" />
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
  const { admin, applyToken, logout } = useAdminAuth();
  const navigate = useNavigate();
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

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="cv-profile-form">
      <section className="card cv-profile-hero">
        <label className={`cv-profile-photo ${player ? "" : "is-disabled"}`.trim()}>
          {player && <input type="file" accept="image/*" hidden onChange={pickPhoto} disabled={setPhoto.isPending} />}
          <PlayerAvatar name={displayName} photoUrl={player?.photoUrl} className="cv-profile-avatar" />
          {player && (
            <span className="cv-profile-cam" aria-hidden="true">
              <i className={`fa-solid ${setPhoto.isPending ? "fa-spinner fa-spin" : "fa-camera"}`}></i>
            </span>
          )}
        </label>
        <div className="cv-profile-id">
          <h2>{displayName}</h2>
          <span>
            {admin?.isSuperAdmin ? "Organiser" : "Player"}
            {player?.role && ` · ${PLAYER_ROLES.find((r) => r.value === player.role)?.label}`}
          </span>
          {player?.photoUrl && (
            <button
              type="button"
              className="cricket-media-remove"
              disabled={setPhoto.isPending}
              onClick={() => setPhoto.mutate(null)}
            >
              Remove photo
            </button>
          )}
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
        <button type="button" className="cv-profile-signout" onClick={handleLogout}>
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sign out
        </button>
      </div>
    </form>
  );
}
