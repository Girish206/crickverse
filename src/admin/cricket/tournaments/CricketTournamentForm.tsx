import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CricketTournamentInput,
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
import { useCricketPlaces } from "../../../api/hooks/cricket/useCricketMatches";
import { useSuggestions } from "../useSuggestions";
import { BallTypeChoice, ChipChoice } from "../CricketChoices";
import { SwitchRow } from "../SwitchRow";
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

type Errors = Partial<Record<"name" | "city" | "ground" | "organiserName" | "organiserMobile" | "organiserEmail" | "startDate" | "endDate" | "category" | "ballType" | "matchType" | "overs" | "bowlerOverLimit" | "image", string>>;

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

// The tournament's current details as an update input: the update is a
// full PUT, so a one-field change (finished, public) sends the rest as is.
export function tournamentInputOf(t: CricketTournament): CricketTournamentInput {
  return {
    name: t.name,
    city: t.city,
    ground: t.ground,
    organiserName: t.organiserName,
    organiserMobile: t.organiserMobile,
    organiserEmail: t.organiserEmail,
    startDate: t.startDate,
    endDate: t.endDate,
    category: t.category,
    ballType: t.ballType,
    pitchType: t.pitchType,
    matchType: t.matchType,
    overs: t.overs,
    ballsPerOver: t.ballsPerOver ?? null,
    bowlerOverLimit: t.bowlerOverLimit ?? null,
    lastManStands: t.lastManStands ?? null,
    freeHit: t.freeHit ?? null,
  };
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
  // Playing conditions every match starts with. The Hundred bowls 5-ball
  // overs; a free hit is on unless turned off.
  const [ballsPerOver, setBallsPerOver] = useState(start?.ballsPerOver ?? (start?.matchType === "hundred" ? 5 : 6));
  const [bowlerLimit, setBowlerLimit] = useState(start?.bowlerOverLimit ? String(start.bowlerOverLimit) : "");
  const [lastManStands, setLastManStands] = useState(Boolean(start?.lastManStands));
  const [freeHit, setFreeHit] = useState(start?.freeHit !== false);
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
      if (previous.ballsPerOver) setBallsPerOver(previous.ballsPerOver);
      if (previous.bowlerOverLimit) setBowlerLimit(String(previous.bowlerOverLimit));
      setLastManStands(Boolean(previous.lastManStands));
      setFreeHit(previous.freeHit !== false);
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
    // The end date can be left open when it isn't fixed yet.
    if (endDate && startDate && endDate < startDate) found.endDate = "Can't be before the start date";
    if (!category) found.category = "Choose a category";
    if (!ballType) found.ballType = "Choose a ball type";
    if (!matchType) found.matchType = "Choose a match type";
    const oversNumber = Number(overs);
    if (!Number.isInteger(oversNumber) || oversNumber < 1 || oversNumber > 100) found.overs = "1 to 100";
    if (bowlerLimit) {
      const limit = Number(bowlerLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) found.bowlerOverLimit = "1 to 50, or leave blank";
      else if (Number.isInteger(oversNumber) && limit > oversNumber) found.bowlerOverLimit = "Can't be more than the overs";
    }
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
      endDate: endDate || null,
      category,
      ballType,
      pitchType,
      matchType,
      overs: Number(overs),
      ballsPerOver,
      bowlerOverLimit: bowlerLimit ? Number(bowlerLimit) : null,
      lastManStands,
      freeHit,
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
  const { data: places } = useCricketPlaces();
  const citySuggest = useSuggestions({
    value: city,
    suggestions: places?.cities ?? [],
    onPick: (value) => {
      setCity(value);
      clear("city");
    },
    icon: "fa-solid fa-city",
  });
  const groundSuggest = useSuggestions({
    value: ground,
    suggestions: places?.grounds ?? [],
    onPick: (value) => {
      setGround(value);
      clear("ground");
    },
  });

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

      {/* Laid out like the match form: titled groups, evenly spaced; the
          text fields keep their floating-label inputs. */}
      <div className="cricket-app-form cricket-tour-form">
        <h2 className="cricket-app-group-title">Tournament</h2>
        <div className="cricket-tour-fields">
          <InputComp label="Tournament / series name" required value={name} error={errors.name} maxLength={150} onChange={text(setName, "name")} />
          <div className="cricket-form-row">
            <InputComp
              label="City"
              required
              value={city}
              error={errors.city}
              maxLength={100}
              {...citySuggest.inputProps}
              onChange={text(setCity, "city")}
            />
            {citySuggest.menu}
            <InputComp
              label="Ground"
              required
              value={ground}
              error={errors.ground}
              maxLength={150}
              {...groundSuggest.inputProps}
              onChange={text(setGround, "ground")}
            />
            {groundSuggest.menu}
          </div>
        </div>

        <h2 className="cricket-app-group-title">Organiser</h2>
        <div className="cricket-tour-fields">
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
        </div>

        {/* Rows like a match's date & time. */}
        <h2 className="cricket-app-group-title">Tournament dates</h2>
        <div className="cricket-app-group">
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-calendar" aria-hidden="true"></i> Start date
            </span>
            <input type="date" required value={startDate} onChange={text(setStartDate, "startDate")} />
          </label>
          {errors.startDate && (
            <div className="cricket-app-row is-hint">
              <small className="text-danger">{errors.startDate}</small>
            </div>
          )}
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-regular fa-calendar-check" aria-hidden="true"></i> End date
            </span>
            <input type="date" min={startDate || undefined} value={endDate} onChange={text(setEndDate, "endDate")} />
          </label>
          {errors.endDate && (
            <div className="cricket-app-row is-hint">
              <small className="text-danger">{errors.endDate}</small>
            </div>
          )}
          <div className="cricket-app-row is-hint">
            <small className="admin-hint">
              Leave the end date empty if it isn't fixed yet. The same start and end date makes it a one-day tournament.
            </small>
          </div>
        </div>

        {/* Chips in a padded group, as on the match form. */}
        <h2 className="cricket-app-group-title">Tournament type</h2>
        <div className="cricket-app-group is-padded">
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
              // The Hundred's sets are 5 balls; moving off it goes back to 6.
              if (value === "hundred") setBallsPerOver(5);
              else if (matchType === "hundred" && ballsPerOver === 5) setBallsPerOver(6);
            }}
          />
        </div>

        {/* The same rows as a match's overs and playing conditions, which they
            fill in. */}
        <h2 className="cricket-app-group-title">Playing conditions</h2>
        <div className="cricket-app-group">
          <div className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-stopwatch" aria-hidden="true"></i> Overs per innings
            </span>
            <span className="cricket-app-stepper">
              <button
                type="button"
                aria-label="Fewer overs"
                disabled={Number(overs) <= 1}
                onClick={() => setOvers(String(Math.max(1, (Number(overs) || 1) - 1)))}
              >
                <i className="fa-solid fa-minus" aria-hidden="true"></i>
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                aria-label="Overs per innings"
                value={overs}
                onChange={text(setOvers, "overs")}
              />
              <button
                type="button"
                aria-label="More overs"
                disabled={Number(overs) >= 100}
                onClick={() => setOvers(String(Math.min(100, (Number(overs) || 0) + 1)))}
              >
                <i className="fa-solid fa-plus" aria-hidden="true"></i>
              </button>
            </span>
          </div>
          {errors.overs && (
            <div className="cricket-app-row is-hint">
              <small className="text-danger">Overs: {errors.overs}</small>
            </div>
          )}
          <div className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-baseball" aria-hidden="true"></i> Balls per over
            </span>
            <span className="cricket-app-stepper">
              <button
                type="button"
                aria-label="Fewer balls an over"
                disabled={ballsPerOver <= 4}
                onClick={() => setBallsPerOver(ballsPerOver - 1)}
              >
                <i className="fa-solid fa-minus" aria-hidden="true"></i>
              </button>
              <input type="number" aria-label="Balls per over" value={ballsPerOver} readOnly />
              <button
                type="button"
                aria-label="More balls an over"
                disabled={ballsPerOver >= 10}
                onClick={() => setBallsPerOver(ballsPerOver + 1)}
              >
                <i className="fa-solid fa-plus" aria-hidden="true"></i>
              </button>
            </span>
          </div>
          <label className="cricket-app-row">
            <span className="cricket-app-row-label">
              <i className="fa-solid fa-user-clock" aria-hidden="true"></i> Max overs per bowler
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              placeholder="No limit"
              value={bowlerLimit}
              onChange={text(setBowlerLimit, "bowlerOverLimit")}
            />
          </label>
          {errors.bowlerOverLimit && (
            <div className="cricket-app-row is-hint">
              <small className="text-danger">{errors.bowlerOverLimit}</small>
            </div>
          )}
          {/* The usual split: a fifth of the overs each, so five bowlers bowl. */}
          {!bowlerLimit && Number(overs) >= 2 && (
            <div className="cricket-app-row is-hint">
              <small className="admin-hint">
                Usually a fifth of the overs —{" "}
                <button
                  type="button"
                  className="admin-link-btn"
                  onClick={() => setBowlerLimit(String(Math.max(1, Math.ceil(Number(overs) / 5))))}
                >
                  use {Math.max(1, Math.ceil(Number(overs) / 5))}
                </button>
              </small>
            </div>
          )}
          <SwitchRow
            icon="fa-solid fa-person"
            label="Last man stands"
            note="The last batter bats on alone"
            on={lastManStands}
            onChange={setLastManStands}
          />
          <SwitchRow
            icon="fa-solid fa-bolt"
            label="Free hit on a no-ball"
            note="The next ball can only be out run out"
            on={freeHit}
            onChange={setFreeHit}
          />
        </div>
        <small className="admin-hint cricket-tour-note">
          Ground, city, match type, ball type, pitch, overs and these playing conditions are filled in on every match you
          schedule (each match can change its own). Changing them here also updates fixtures not played yet.
        </small>
      </div>

      <SubmitButton loading={saving}>{existing ? "Save" : "Create"}</SubmitButton>
    </ModalForm>
  );
}
