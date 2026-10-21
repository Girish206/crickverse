import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateCricketTournament,
  useCricketTournaments,
  useSetCricketTournamentImages,
  useUpdateCricketTournament,
} from "../../../api/hooks/cricket/useCricketTournaments";
import type {
  CricketBallType,
  CricketCategory,
  CricketMatchType,
  CricketPitchType,
  CricketTournament,
} from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ModalForm } from "../../components/ModalForm";
import { SubmitButton } from "../../components/SubmitButton";
import InputComp from "../../dms/components/InputComp";
import { BallTypeChoice, ChipChoice } from "../CricketChoices";
import { CATEGORIES, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import {
  compressImage,
  MAX_UPLOAD_BYTES,
  TOURNAMENT_BANNER,
  TOURNAMENT_LOGO,
  type CompressOptions,
} from "../../../utils/compressImage";

// Stored dates are UTC midnight; <input type="date"> wants "YYYY-MM-DD".
const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

type Errors = Partial<Record<"name" | "city" | "ground" | "organiserName" | "organiserMobile" | "organiserEmail" | "startDate" | "endDate" | "category" | "ballType" | "matchType" | "overs" | "image", string>>;

// A picked image: a new file (with a preview URL), the current one, or none.
function useImagePick(current: string | null | undefined) {
  const [file, setFile] = useState<File | null | undefined>(undefined);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const shown = file === undefined ? (current ?? null) : preview;
  return { file, setFile, shown };
}

export interface CricketTournamentFormProps {
  existing?: CricketTournament;
  onSaved: () => void;
}

export function CricketTournamentForm({ existing, onSaved }: CricketTournamentFormProps) {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const { data: tournaments } = useCricketTournaments();
  const createTournament = useCreateCricketTournament();
  const updateTournament = useUpdateCricketTournament();
  const setImages = useSetCricketTournamentImages();

  // A new tournament starts from the organiser's last one (newest first).
  const previous = existing ? undefined : tournaments?.[0];
  const start = existing ?? previous;

  const [name, setName] = useState(existing?.name ?? "");
  const [city, setCity] = useState(start?.city ?? "");
  const [ground, setGround] = useState(start?.ground ?? "");
  const [organiserName, setOrganiserName] = useState(start?.organiserName ?? admin?.name ?? "");
  const [organiserMobile, setOrganiserMobile] = useState(start?.organiserMobile ?? "");
  const [organiserEmail, setOrganiserEmail] = useState(start?.organiserEmail ?? admin?.email ?? "");
  const [startDate, setStartDate] = useState(existing ? toDateInput(existing.startDate) : today());
  const [endDate, setEndDate] = useState(toDateInput(existing?.endDate));
  const [category, setCategory] = useState<CricketCategory | null>(start?.category ?? null);
  const [ballType, setBallType] = useState<CricketBallType | null>(start?.ballType ?? null);
  const [pitchType, setPitchType] = useState<CricketPitchType | null>(start?.pitchType ?? null);
  const [matchType, setMatchType] = useState<CricketMatchType | null>(start?.matchType ?? "limited-overs");
  const [overs, setOvers] = useState(start?.overs ? String(start.overs) : "6");
  const logo = useImagePick(existing?.logoUrl);
  const banner = useImagePick(existing?.bannerUrl);
  const [errors, setErrors] = useState<Errors>({});

  // The list loads after the form opens: fill the blanks from the last
  // tournament once it arrives, without touching anything already typed.
  const [prefilled, setPrefilled] = useState(Boolean(existing));
  if (!prefilled && tournaments) {
    setPrefilled(true);
    if (previous) {
      if (!city) setCity(previous.city ?? "");
      if (!ground) setGround(previous.ground ?? "");
      if (!organiserMobile) setOrganiserMobile(previous.organiserMobile ?? "");
      if (previous.organiserName && organiserName === (admin?.name ?? "")) setOrganiserName(previous.organiserName);
      if (previous.organiserEmail && organiserEmail === (admin?.email ?? "")) setOrganiserEmail(previous.organiserEmail);
      if (!category) setCategory(previous.category);
      if (!ballType) setBallType(previous.ballType);
      if (!pitchType) setPitchType(previous.pitchType);
      if (previous.matchType) setMatchType(previous.matchType);
      if (previous.overs) setOvers(String(previous.overs));
    }
  }

  const saving = createTournament.isPending || updateTournament.isPending || setImages.isPending;
  const clear = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined }));

  function pickImage(pick: ReturnType<typeof useImagePick>, options: CompressOptions) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      e.target.value = "";
      if (!picked) return;
      const fail = (image: string) => setErrors((c) => ({ ...c, image }));
      if (!picked.type.startsWith("image/")) return fail("Choose an image file.");
      try {
        const file = await compressImage(picked, options);
        if (file.size > MAX_UPLOAD_BYTES) return fail("This image is too large. Try a smaller one.");
        clear("image");
        pick.setFile(file);
      } catch (err) {
        fail((err as Error).message);
      }
    };
  }

  function validate(): Errors {
    const found: Errors = {};
    const required = "Required";
    if (!name.trim()) found.name = required;
    if (!city.trim()) found.city = required;
    if (!ground.trim()) found.ground = required;
    if (!organiserName.trim()) found.organiserName = required;
    const digits = organiserMobile.replace(/\D/g, "");
    if (!digits) found.organiserMobile = required;
    else if (digits.length < 10 || digits.length > 15) found.organiserMobile = "Enter a valid mobile number";
    if (organiserEmail.trim() && !/^\S+@\S+\.\S+$/.test(organiserEmail.trim())) found.organiserEmail = "Enter a valid email";
    if (!startDate) found.startDate = required;
    if (!endDate) found.endDate = required;
    else if (startDate && endDate < startDate) found.endDate = "Can't be before the start date";
    if (!category) found.category = "Choose a category";
    if (!ballType) found.ballType = "Choose a ball type";
    if (!matchType) found.matchType = "Choose a match type";
    const oversNumber = Number(overs);
    if (!Number.isInteger(oversNumber) || oversNumber < 1 || oversNumber > 50) found.overs = "1 to 50";
    return found;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const input = {
      name: name.trim(),
      city: city.trim(),
      ground: ground.trim(),
      organiserName: organiserName.trim(),
      organiserMobile: organiserMobile.replace(/[^\d+]/g, ""),
      organiserEmail: organiserEmail.trim() || null,
      startDate,
      endDate,
      category,
      ballType,
      pitchType,
      matchType,
      overs: Number(overs),
    };
    const saved = existing
      ? await updateTournament.mutateAsync({ id: existing.id, ...input })
      : await createTournament.mutateAsync(input);
    if (logo.file !== undefined || banner.file !== undefined) {
      await setImages.mutateAsync({ id: saved.id, logo: logo.file, banner: banner.file });
    }
    onSaved();
    if (!existing) navigate(`/tournaments/${saved.id}`);
  }

  const text = (setter: (value: string) => void, key: keyof Errors) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    clear(key);
  };

  return (
    <ModalForm onSubmit={onSubmit}>
      <div className="cricket-tour-media">
        <label className="cricket-banner-pick" style={banner.shown ? { backgroundImage: `url(${banner.shown})` } : undefined}>
          <input type="file" accept="image/*" hidden onChange={pickImage(banner, TOURNAMENT_BANNER)} />
          {!banner.shown && (
            <span>
              <i className="fa-regular fa-image" aria-hidden="true"></i> Add banner
            </span>
          )}
          <span className="cricket-media-cam">
            <i className="fa-solid fa-camera" aria-hidden="true"></i>
          </span>
        </label>
        {banner.shown && (
          <button type="button" className="cricket-media-remove is-banner" onClick={() => banner.setFile(null)}>
            Remove banner
          </button>
        )}
        <div className="cricket-logo-wrap">
          <label className="cricket-logo-pick" style={logo.shown ? { backgroundImage: `url(${logo.shown})` } : undefined}>
            <input type="file" accept="image/*" hidden onChange={pickImage(logo, TOURNAMENT_LOGO)} />
            {!logo.shown && <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>}
            <span className="cricket-media-cam">
              <i className="fa-solid fa-camera" aria-hidden="true"></i>
            </span>
          </label>
          <span className="cricket-logo-caption">
            {logo.shown ? (
              <button type="button" className="cricket-media-remove" onClick={() => logo.setFile(null)}>
                Remove logo
              </button>
            ) : (
              "Add logo"
            )}
          </span>
        </div>
      </div>
      {errors.image && <div className="admin-banner admin-banner-error mt-2">{errors.image}</div>}

      <InputComp label="Tournament / series name" required value={name} error={errors.name} maxLength={150} onChange={text(setName, "name")} />
      <div className="cricket-form-row">
        <InputComp label="City" required value={city} error={errors.city} maxLength={100} onChange={text(setCity, "city")} />
        <InputComp label="Ground" required value={ground} error={errors.ground} maxLength={150} onChange={text(setGround, "ground")} />
      </div>
      <div className="cricket-form-row">
        <InputComp
          label="Organiser name"
          required
          value={organiserName}
          error={errors.organiserName}
          maxLength={100}
          onChange={text(setOrganiserName, "organiserName")}
        />
        <InputComp
          label="Organiser number"
          required
          type="tel"
          inputMode="tel"
          value={organiserMobile}
          error={errors.organiserMobile}
          maxLength={20}
          onChange={text(setOrganiserMobile, "organiserMobile")}
        />
      </div>
      <InputComp
        label="Organiser email"
        type="email"
        value={organiserEmail}
        error={errors.organiserEmail}
        maxLength={150}
        onChange={text(setOrganiserEmail, "organiserEmail")}
      />

      <h3 className="cricket-form-section">Tournament dates</h3>
      <div className="cricket-form-row">
        <InputComp label="Start date" type="date" required value={startDate} error={errors.startDate} onChange={text(setStartDate, "startDate")} />
        <InputComp
          label="End date"
          type="date"
          required
          min={startDate || undefined}
          value={endDate}
          error={errors.endDate}
          onChange={text(setEndDate, "endDate")}
        />
      </div>

      <ChipChoice
        label="Tournament category"
        required
        options={CATEGORIES}
        value={category}
        error={errors.category}
        onChange={(value) => {
          setCategory(value);
          clear("category");
        }}
      />
      <BallTypeChoice
        required
        value={ballType}
        error={errors.ballType}
        onChange={(value) => {
          setBallType(value);
          clear("ballType");
        }}
      />
      <ChipChoice label="Pitch type" options={PITCH_TYPES} value={pitchType} onChange={setPitchType} />
      <ChipChoice
        label="Match type"
        required
        options={MATCH_TYPES}
        value={matchType}
        error={errors.matchType}
        onChange={(value) => {
          setMatchType(value);
          clear("matchType");
        }}
      />
      <div className="cricket-form-row">
        <InputComp
          label="Overs per innings"
          type="number"
          min={1}
          max={50}
          required
          value={overs}
          error={errors.overs}
          onChange={text(setOvers, "overs")}
        />
      </div>
      <small className="admin-hint d-block mb-2">
        Ground, city, match type, ball type, pitch and overs are filled in on every match you schedule.
      </small>

      <SubmitButton loading={saving}>{existing ? "Save" : "Create"}</SubmitButton>
    </ModalForm>
  );
}
