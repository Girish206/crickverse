import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateCricketPlayer,
  useCreateCricketPlayersBulk,
  useCricketPlayers,
  useGrantCricketPlayerLogin,
  useRevokeCricketPlayerLogin,
  useSetCricketPlayerPhoto,
  useUpdateCricketPlayer,
} from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketPlayer, CricketPlayerRole } from "../../../api/types";
import { Button } from "../../components/Button";
import { ModalForm } from "../../components/ModalForm";
import { SubmitButton } from "../../components/SubmitButton";
import { confirmAction } from "../../components/confirmDelete";
import InputComp from "../../dms/components/InputComp";
import TextareaInput from "../../dms/components/TextareaInput";
import { ChipChoice } from "../CricketChoices";
import { PLAYER_ROLES } from "../playerRoles";
import { formatMobile, normalizeMobile } from "../mobile";
import { PlayerAvatar } from "./PlayerAvatar";
import { compressImage, MAX_UPLOAD_BYTES, PLAYER_PHOTO } from "../../../utils/compressImage";
import { Loader } from "../../components/Loader";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  role: z.string().nullable(),
  mobile: z.string().refine((value) => normalizeMobile(value) !== null, "Enter a valid 10-digit mobile number"),
});
type FormValues = z.infer<typeof schema>;

export interface CricketPlayerFormProps {
  id?: number;
  onSaved: () => void;
}

export function CricketPlayerForm({ id, onSaved }: CricketPlayerFormProps) {
  const { data: players } = useCricketPlayers();
  const existing = id !== undefined ? players?.find((player) => player.id === id) : undefined;
  const createPlayer = useCreateCricketPlayer();
  const updatePlayer = useUpdateCricketPlayer();
  const setPhoto = useSetCricketPlayerPhoto();
  // A new file, null to remove the current photo, undefined to leave it.
  const [photo, setPhotoFile] = useState<File | null | undefined>(undefined);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const shownPhoto = photo === undefined ? (existing?.photoUrl ?? null) : preview;

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) return setPhotoError("Choose an image file.");
    try {
      const file = await compressImage(picked, PLAYER_PHOTO);
      if (file.size > MAX_UPLOAD_BYTES) return setPhotoError("This photo is too large. Try a smaller one.");
      setPhotoError(null);
      setPhotoFile(file);
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { name: existing?.name ?? "", role: existing?.role ?? null, mobile: existing?.mobile ?? "" },
  });

  async function onSubmit(values: FormValues) {
    const input = {
      name: values.name,
      role: (values.role || null) as CricketPlayerRole | null,
      mobile: normalizeMobile(values.mobile)!,
    };
    const saved = existing
      ? await updatePlayer.mutateAsync({ id: existing.id, ...input })
      : await createPlayer.mutateAsync(input);
    if (photo !== undefined) await setPhoto.mutateAsync({ id: saved.id, photo });
    onSaved();
  }

  if (id !== undefined && !existing) return <Loader />;

  return (
    <ModalForm onSubmit={handleSubmit(onSubmit)}>
      <div className="cricket-photo-pick">
        <label>
          <input type="file" accept="image/*" hidden onChange={pickPhoto} />
          <PlayerAvatar name={existing?.name || "?"} photoUrl={shownPhoto} className="cricket-player-avatar" />
          <span className="cricket-media-cam">
            <i className="fa-solid fa-camera" aria-hidden="true"></i>
          </span>
        </label>
        <span className="cricket-photo-pick-actions">
          {shownPhoto ? "Profile photo" : "Add a profile photo"}
          {shownPhoto && (
            <button type="button" className="cricket-media-remove" onClick={() => setPhotoFile(null)}>
              Remove photo
            </button>
          )}
        </span>
      </div>
      {photoError && <div className="admin-banner admin-banner-error mb-2">{photoError}</div>}
      <Controller
        name="name"
        control={control}
        render={({ field }) => <InputComp label="Player Name" required {...field} error={errors.name?.message} />}
      />
      <Controller
        name="mobile"
        control={control}
        render={({ field }) => (
          <InputComp
            label="Mobile Number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            {...field}
            error={errors.mobile?.message}
          />
        )}
      />
      {existing?.hasLogin && (
        <small className="admin-hint d-block ms-1">
          They sign in with this number — changing it changes their login too.
        </small>
      )}
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <ChipChoice
            label="Playing role"
            options={PLAYER_ROLES.map((role) => ({ value: role.value, label: role.label }))}
            value={field.value as CricketPlayerRole | null}
            onChange={field.onChange}
          />
        )}
      />
      <SubmitButton loading={isSubmitting}>Save</SubmitButton>
    </ModalForm>
  );
}

// One player per line: a name and a mobile number, e.g. "Ravi Kumar, 98765 43210".
function parseLines(text: string) {
  const rows: { name: string; mobile: string }[] = [];
  const bad: string[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const match = /^(.*?)[\s,;:\t-]+(\+?[\d\s-]{10,})$/.exec(line);
    const mobile = match ? normalizeMobile(match[2]) : null;
    const name = match?.[1].replace(/[\s,;:-]+$/, "").trim();
    if (!name || !mobile) bad.push(line);
    else rows.push({ name, mobile });
  }
  return { rows, bad };
}

export function CricketPlayersBulkForm({
  onSaved,
}: {
  onSaved: (result: { added: number; skipped: number; skippedNames: string[] }) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bulkCreate = useCreateCricketPlayersBulk();
  const { rows, bad } = parseLines(text);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (bad.length > 0) {
      setError(`Each line needs a name and a 10-digit mobile number. Check: ${bad.slice(0, 3).join(" | ")}`);
      return;
    }
    if (rows.length === 0) {
      setError("Enter at least one player.");
      return;
    }
    onSaved(await bulkCreate.mutateAsync(rows));
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <TextareaInput
        label="Players — name and mobile number, one per line"
        rows={10}
        placeholder={"Ravi Kumar, 9876543210\nAsha 98765 43211\nKiran - 9876543212"}
        value={text}
        error={error ?? ""}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      <small className="admin-hint">
        {rows.length} player{rows.length === 1 ? "" : "s"} ready
        {bad.length > 0 ? `, ${bad.length} line${bad.length === 1 ? "" : "s"} need fixing` : ""} — anyone whose number
        is already listed is skipped.
      </small>
      <SubmitButton loading={bulkCreate.isPending}>Add Players</SubmitButton>
    </ModalForm>
  );
}

// Lets a player sign in with their mobile number to see their own stats.
export function CricketPlayerLoginForm({ player, onDone }: { player: CricketPlayer; onDone: () => void }) {
  const grant = useGrantCricketPlayerLogin();
  const revoke = useRevokeCricketPlayerLogin();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!player.hasLogin && password.length < 8) return setError("Set a password of at least 8 characters.");
    if (password && password.length < 8) return setError("Passwords need at least 8 characters.");
    await grant.mutateAsync({ id: player.id, password: password || undefined });
    onDone();
  }

  async function handleRevoke() {
    if (await confirmAction("Turn off app login?", `${player.name} won't be able to sign in to see their stats.`, "Turn off")) {
      await revoke.mutateAsync(player.id);
      onDone();
    }
  }

  if (!player.mobile) {
    return <div className="admin-banner admin-banner-error">Add {player.name}'s mobile number first — it's their login.</div>;
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <p className="mb-2">
        {player.name} signs in with <strong>{formatMobile(player.mobile)}</strong> and sees their own stats, matches and
        tournaments.
      </p>
      <InputComp
        label={player.hasLogin ? "New password (leave blank to keep)" : "Password"}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        icon={`fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`}
        iconOnClick={() => setShow((s) => !s)}
        value={password}
        error={error ?? undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setPassword(e.target.value);
          setError(null);
        }}
      />
      {player.hasLogin && (
        <div className="mt-2">
          <Button variant="danger-text" onClick={handleRevoke} disabled={revoke.isPending}>
            Turn off app login
          </Button>
        </div>
      )}
      <SubmitButton loading={grant.isPending}>{player.hasLogin ? "Save" : "Give app login"}</SubmitButton>
    </ModalForm>
  );
}
