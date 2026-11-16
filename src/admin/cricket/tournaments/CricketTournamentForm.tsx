import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type CricketTournamentInput,
  useCreateCricketTournament,
  useCricketTournaments,
  useSetCricketTournamentImages,
  useSetCricketTournamentOrganisers,
  useUpdateCricketTournament,
} from "../../../api/hooks/cricket/useCricketTournaments";
import { CoOrganisersSheet } from "./OrganisersSheet";
import { BottomSheet } from "../BottomSheet";
import { TournamentLogo } from "./TournamentLogo";
import { seasonLabelOf, seasonOf as seasonInfoOf, seasonsOf, seriesOf } from "./TournamentCard";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import type {
  CricketBallType,
  CricketCategory,
  CricketMatchType,
  CricketPitchType,
  CricketPlayer,
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

type Errors = Partial<Record<"name" | "city" | "ground" | "organiserName" | "organiserMobile" | "organiserEmail" | "startDate" | "endDate" | "category" | "ballType" | "matchType" | "overs" | "bowlerOverLimit" | "powerplayOvers" | "image", string>>;

// Field names as shown in the "fix these fields" toast.
const FIELD_LABELS: Record<keyof Errors, string> = {
  name: "Name",
  city: "City",
  ground: "Ground",
  organiserName: "Organiser name",
  organiserMobile: "Organiser mobile",
  organiserEmail: "Organiser email",
  startDate: "Start date",
  endDate: "End date",
  category: "Category",
  ballType: "Ball type",
  matchType: "Match type",
  overs: "Overs",
  bowlerOverLimit: "Overs per bowler",
  powerplayOvers: "Powerplay overs",
  image: "Image",
};

const NEW_TOURNAMENT = "__new";

// The tournaments a new season can be added to: the ones `mine` says the
// viewer runs (any season created or co-organised by them), plus `also`
// (opened from that tournament's page). Ones with seasons come first,
// then newest first; each with its last season, whose details it copies.
type SeriesChoice = {
  key: string;
  name: string;
  last: CricketTournament;
  lastSeason: string;
  // Every season's name, for numbering the next one.
  seasonLabels: string[];
  count: number;
  hasSeasons: boolean;
};

function seriesChoices(tournaments: CricketTournament[], mine: (t: CricketTournament) => boolean, also?: string) {
  const byKey = new Map<string, SeriesChoice>();
  for (const t of tournaments) {
    const { key, name } = seriesOf(t);
    if (byKey.has(key)) continue;
    const seasons = seasonsOf(tournaments, key);
    if (key !== also && !seasons.some(mine)) continue;
    byKey.set(key, {
      key,
      name,
      last: seasons[0],
      lastSeason: seasonLabelOf(seasons[0], tournaments),
      seasonLabels: seasons.map((t) => seasonLabelOf(t, tournaments)),
      count: seasons.length,
      hasSeasons: seasonInfoOf(seasons[0], tournaments) !== null,
    });
  }
  const when = (c: SeriesChoice) => c.last.startDate ?? c.last.createdAt;
  return [...byKey.values()].sort((a, b) => Number(b.hasSeasons) - Number(a.hasSeasons) || when(b).localeCompare(when(a)));
}

// "New season" -> "Which tournament?": a sheet listing every tournament the
// viewer organised or co-organised, with a search once there are many.
function SeriesSheet({
  series,
  pickedKey,
  onPick,
  onClose,
}: {
  series: SeriesChoice[];
  pickedKey: string | null;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = term ? series.filter((s) => s.name.toLowerCase().includes(term)) : series;
  return (
    <BottomSheet title="Your tournaments" icon="fa-solid fa-layer-group" count={series.length} onClose={onClose}>
      <p className="admin-hint">Tournaments you organised or co-organised. Pick one to add its next season.</p>
      {series.length > 5 && (
        <input
          type="search"
          className="cricket-picker-search"
          placeholder="Search your tournaments"
          aria-label="Search your tournaments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <div className="admin-empty-state">No tournament of yours matches "{search}".</div>
      ) : (
        <ul className="cricket-picker-list">
          {shown.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                className={`cricket-picker-item ${s.key === pickedKey ? "is-picked" : ""}`.trim()}
                aria-pressed={s.key === pickedKey}
                onClick={() => {
                  onPick(s.key);
                  onClose();
                }}
              >
                <TournamentLogo tournament={s.last} className="cricket-picker-avatar" />
                <span className="cricket-picker-text">
                  <strong>{s.name}</strong>
                  <small>
                    {s.hasSeasons
                      ? `${s.count} season${s.count === 1 ? "" : "s"} · last: ${s.lastSeason}`
                      : "No seasons yet: this one becomes Season 2"}
                  </small>
                </span>
                <i
                  className={`fa-solid ${s.key === pickedKey ? "fa-circle-check" : "fa-chevron-right"} cricket-app-row-chevron`}
                  aria-hidden="true"
                ></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}

// A season's number from its name, wherever it is: "Season 38",
// "APL Season 38", "S38", "Edition 4", "APL 38". A year ("2026") isn't one.
export function seasonNumberOf(label: string): number | null {
  const text = label.trim();
  const named = /\b(?:season|edition|s)\s*-?\s*(\d{1,3})\b/i.exec(text);
  if (named) return Number(named[1]);
  const trailing = /(?:^|\D)(\d{1,3})\s*$/.exec(text);
  return trailing ? Number(trailing[1]) : null;
}

// The next season's name: one past the highest numbered season so far
// ("APL Season 38" → "Season 39"), and never below the count of seasons
// (seasons named without a number, like "Nov 2026", still count).
export function nextSeason(labels: string[], count: number) {
  const numbers = labels.map(seasonNumberOf).filter((n): n is number => n !== null);
  return `Season ${Math.max(count, ...numbers) + 1}`;
}

// A picked image: a new file (with a preview URL), the current one, or none.
export function useImagePick(current: string | null | undefined) {
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
    seriesName: t.seriesName ?? null,
    season: t.season ?? null,
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
    impactPlayer: t.impactPlayer ?? null,
    freeHit: t.freeHit ?? null,
    powerplayOvers: t.powerplayOvers ?? null,
  };
}

export interface CricketTournamentFormProps {
  existing?: CricketTournament;
  // A new season of this tournament (its series key), from its page.
  seasonOf?: string;
  onSaved: () => void;
}

export function CricketTournamentForm({ existing, seasonOf, onSaved }: CricketTournamentFormProps) {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const { data: tournaments } = useCricketTournaments();
  const createTournament = useCreateCricketTournament();
  const updateTournament = useUpdateCricketTournament();
  const setImages = useSetCricketTournamentImages();
  const setOrganisers = useSetCricketTournamentOrganisers();
  const queryClient = useQueryClient();
  // New tournaments only; an existing one changes them from its settings.
  const [coOrganisers, setCoOrganisers] = useState<CricketPlayer[]>([]);
  const organiserIds = coOrganisers.map((p) => p.id);
  const [editingCoOrganisers, setEditingCoOrganisers] = useState(false);

  // A new tournament starts from the organiser's last one (newest first).
  const previous = existing ? undefined : tournaments?.[0];
  const start = existing ?? previous;

  const [name, setName] = useState(existing?.name ?? "");
  // Editing a season: its tournament's name (named, else read from its own
  // name) and the season's name, as on create.
  const [seriesName, setSeriesName] = useState(existing ? (existing.seriesName ?? seriesOf(existing).name) : "");
  const [season, setSeason] = useState(existing?.season ?? "");
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
  const [impactPlayer, setImpactPlayer] = useState(Boolean(start?.impactPlayer));
  const [freeHit, setFreeHit] = useState(start?.freeHit !== false);
  const [hasPowerplay, setHasPowerplay] = useState(Boolean(start?.powerplayOvers));
  const [powerplayOvers, setPowerplayOvers] = useState(start?.powerplayOvers ? String(start.powerplayOvers) : "");
  const logo = useImagePick(existing?.logoUrl);
  const banner = useImagePick(existing?.bannerUrl);
  const [errors, setErrors] = useState<Errors>({});

  // New ones: a one-off tournament, a tournament with seasons (APL, its
  // Season 1), or the next season of one already run. A season is stored
  // as "APL Season 2" with APL as its series; inside APL it shows as just
  // "Season 2". Picking a tournament copies its last season's details.
  const { data: me } = useCricketMe();
  const myPlayerId = me?.player?.id;
  // Mine = the ones I created or co-organise: the server's own list (/me),
  // plus a check by id while it loads.
  const myTournaments = me?.createdTournaments;
  const series = useMemo(() => {
    const mineIds = new Set((myTournaments ?? []).map((t) => t.id));
    const all = [...new Map([...(tournaments ?? []), ...(myTournaments ?? [])].map((t) => [t.id, t])).values()];
    return seriesChoices(
      all,
      (t) =>
        mineIds.has(t.id) ||
        (t.createdById != null && String(t.createdById) === admin?.sub) ||
        (myPlayerId !== undefined && (t.organiserIds ?? []).includes(myPlayerId)),
      seasonOf,
    );
  }, [tournaments, myTournaments, admin?.sub, myPlayerId, seasonOf]);
  const [seriesKey, setSeriesKey] = useState<string>(NEW_TOURNAMENT);
  // "New season" chosen: which tournament, from a searchable list.
  const [addingSeason, setAddingSeason] = useState(false);
  const [choosingSeries, setChoosingSeries] = useState(false);
  const [repeats, setRepeats] = useState(Boolean(existing && (existing.seriesName || existing.season)));
  const [seasonTouched, setSeasonTouched] = useState(false);
  // Editing: the full name is rebuilt only once its tournament or season
  // name is changed, so an untouched one keeps its name as it is.
  const [editTouched, setEditTouched] = useState(false);
  const picked = series.find((s) => s.key === seriesKey);
  const autoSeason = picked ? nextSeason(picked.seasonLabels, picked.count) : "Season 1";
  const shownSeason = existing || seasonTouched ? season : autoSeason;
  // A new season starts with its tournament's last logo and banner (kept
  // unless replaced or removed here).
  const logoShown = logo.file === undefined ? (existing?.logoUrl ?? picked?.last.logoUrl ?? null) : logo.shown;
  const bannerShown = banner.file === undefined ? (existing?.bannerUrl ?? picked?.last.bannerUrl ?? null) : banner.shown;
  const isSeason = existing ? repeats && editTouched : Boolean(picked) || repeats;
  const fullName = existing
    ? repeats && editTouched
      ? `${seriesName.trim()} ${season.trim()}`.trim()
      : name
    : picked
      ? `${picked.name} ${shownSeason}`
      : repeats
        ? `${name.trim()} ${shownSeason}`
        : name;

  function copyFrom(t: CricketTournament) {
    setCity(t.city ?? "");
    setGround(t.ground ?? "");
    if (t.organiserName) setOrganiserName(t.organiserName);
    if (t.organiserMobile) setOrganiserMobile(t.organiserMobile);
    if (t.organiserEmail) setOrganiserEmail(t.organiserEmail);
    setCategory(t.category);
    setBallType(t.ballType);
    setPitchType(t.pitchType);
    if (t.matchType) setMatchType(t.matchType);
    if (t.overs) setOvers(String(t.overs));
    setBallsPerOver(t.ballsPerOver ?? (t.matchType === "hundred" ? 5 : 6));
    setBowlerLimit(t.bowlerOverLimit ? String(t.bowlerOverLimit) : "");
    setLastManStands(Boolean(t.lastManStands));
    setImpactPlayer(Boolean(t.impactPlayer));
    setFreeHit(t.freeHit !== false);
    setHasPowerplay(Boolean(t.powerplayOvers));
    setPowerplayOvers(t.powerplayOvers ? String(t.powerplayOvers) : "");
  }

  function pickSeries(key: string | null) {
    const next = key ?? NEW_TOURNAMENT;
    setSeriesKey(next);
    setAddingSeason(next !== NEW_TOURNAMENT);
    setSeasonTouched(false);
    clear("name");
    const choice = series.find((s) => s.key === next);
    if (choice) {
      setSeriesName(choice.name);
      copyFrom(choice.last);
    } else {
      setSeriesName("");
      setName("");
    }
  }

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
      setImpactPlayer(Boolean(previous.impactPlayer));
      setFreeHit(previous.freeHit !== false);
      setHasPowerplay(Boolean(previous.powerplayOvers));
      setPowerplayOvers(previous.powerplayOvers ? String(previous.powerplayOvers) : "");
    }
  }

  const saving = createTournament.isPending || updateTournament.isPending || setImages.isPending || setOrganisers.isPending;
  const clear = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined }));

  // Opened from a tournament's page ("New season"): start on it once the
  // list has loaded.
  const [seasonApplied, setSeasonApplied] = useState(!seasonOf);
  if (!seasonApplied && seasonOf && series.some((s) => s.key === seasonOf)) {
    setSeasonApplied(true);
    pickSeries(seasonOf);
  }

  function pickImage(pick: ReturnType<typeof useImagePick>, options: CompressOptions) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      e.target.value = "";
      if (!picked) return;
      const fail = (image: string) => {
        setErrors((c) => ({ ...c, image }));
        toast.error(image, { duration: 5000 });
      };
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
    if (addingSeason && !picked) found.name = "Pick the tournament";
    else if (!(picked ? shownSeason : existing && repeats ? seriesName : name).trim()) found.name = required;
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
    if (hasPowerplay) {
      const powerplay = Number(powerplayOvers);
      if (!Number.isInteger(powerplay) || powerplay < 1 || powerplay > 50) found.powerplayOvers = "1 to 50";
      else if (Number.isInteger(oversNumber) && powerplay > oversNumber) found.powerplayOvers = "Can't be more than the overs";
    }
    return found;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const keys = (Object.keys(found) as (keyof Errors)[]).filter((key) => found[key]);
    if (keys.length) {
      // Also a toast, since the field messages may be scrolled out of view.
      toast.error(
        keys.length === 1
          ? `${FIELD_LABELS[keys[0]]}: ${found[keys[0]]}`
          : `Please fix ${keys.length} fields: ${keys.map((key) => FIELD_LABELS[key]).join(", ")}`,
        { duration: 5000 },
      );
      return;
    }
    const input = {
      name: fullName.trim(),
      // A tournament with seasons is the series; each season one entry in it.
      seriesName: (existing ? (repeats ? seriesName : "") : picked ? picked.name : repeats ? name : "").trim() || null,
      season: (existing ? (repeats ? season : "") : isSeason ? shownSeason : "").trim() || null,
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
      impactPlayer,
      freeHit,
      powerplayOvers: hasPowerplay ? Number(powerplayOvers) : null,
    };
    const saved = existing
      ? await updateTournament.mutateAsync({ id: existing.id, ...input })
      : await createTournament.mutateAsync({ ...input, imagesFrom: picked?.last.id });
    if (logo.file !== undefined || banner.file !== undefined) {
      await setImages.mutateAsync({ id: saved.id, logo: logo.file, banner: banner.file });
    }
    if (!existing) {
      // The organiser named on the form (when it isn't you) is already a
      // co-organiser; add the ones picked here alongside. If this fails
      // (shown as a toast), they can be added again from its settings.
      if (organiserIds.length > 0) {
        const playerIds = [...new Set([...(saved.organiserIds ?? []), ...organiserIds])];
        await setOrganisers.mutateAsync({ id: saved.id, playerIds }).catch(() => undefined);
      }
      // A number new to RunMitra became a player, to show on the Info tab.
      void queryClient.invalidateQueries({ queryKey: ["cricket-players"] });
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
  // The series already in use, so a new season joins the same one.
  const seriesSuggest = useSuggestions({
    value: seriesName,
    suggestions: [...new Set((tournaments ?? []).flatMap((t) => (t.seriesName ? [t.seriesName] : [])))],
    onPick: setSeriesName,
    icon: "fa-solid fa-layer-group",
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

      {/* The banner, with the logo centred over its bottom edge. */}
      <div className={`cricket-tour-media ${logoShown ? "has-logo" : ""}`.trim()}>
        <label className="cricket-banner-pick" style={bannerShown ? { backgroundImage: `url(${bannerShown})` } : undefined}>
          <input type="file" accept="image/*" hidden onChange={pickImage(banner, TOURNAMENT_BANNER)} />
          {!bannerShown && (
            <span>
              <i className="fa-regular fa-image" aria-hidden="true"></i> Add banner
            </span>
          )}
          <span className="cricket-media-cam">
            <i className="fa-solid fa-camera" aria-hidden="true"></i>
          </span>
        </label>
        {bannerShown && (
          <button type="button" className="cricket-media-remove is-banner" onClick={() => banner.setFile(null)}>
            Remove banner
          </button>
        )}
        <div className="cricket-logo-wrap is-centered">
          <label
            className="cricket-logo-pick"
            aria-label={logoShown ? "Change logo" : "Add logo"}
            style={logoShown ? { backgroundImage: `url(${logoShown})` } : undefined}
          >
            <input type="file" accept="image/*" hidden onChange={pickImage(logo, TOURNAMENT_LOGO)} />
            {!logoShown && (
              <>
                <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                <span className="cricket-logo-pick-label">Logo</span>
              </>
            )}
            <span className="cricket-media-cam">
              <i className="fa-solid fa-camera" aria-hidden="true"></i>
            </span>
          </label>
          {logoShown && (
            <button type="button" className="cricket-media-remove" onClick={() => logo.setFile(null)}>
              Remove logo
            </button>
          )}
        </div>
      </div>
      {errors.image && <div className="admin-banner admin-banner-error mt-2">{errors.image}</div>}

      {/* Laid out like the match form: titled groups, evenly spaced; the
          text fields keep their floating-label inputs. */}
      <div className="cricket-app-form cricket-tour-form">
        {/* 1. A new tournament, or the next season of one already run. */}
        {!existing && series.length > 0 && (
          <>
            <h2 className="cricket-app-group-title">What are you creating?</h2>
            <div className="cricket-create-kind" role="radiogroup" aria-label="What are you creating?">
              {(
                [
                  ["new", "fa-trophy", "New tournament", "Set up a new one from scratch"],
                  ["season", "fa-layer-group", "New season", "Continue one you already run"],
                ] as const
              ).map(([value, icon, title, note]) => {
                const on = (value === "season") === addingSeason;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`cricket-create-kind-option ${on ? "is-on" : ""}`.trim()}
                    onClick={() => {
                      if (value === "new") return pickSeries(NEW_TOURNAMENT);
                      setAddingSeason(true);
                      if (!picked) setChoosingSeries(true);
                    }}
                  >
                    <span className="cricket-create-kind-icon">
                      <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                    </span>
                    <span className="cricket-create-kind-text">
                      <strong>{title}</strong>
                      <small>{note}</small>
                    </span>
                    {on && <i className="fa-solid fa-circle-check cricket-create-kind-check" aria-hidden="true"></i>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 2. Its name: a tournament's, or the season's within one. */}
        <h2 className="cricket-app-group-title">{addingSeason ? "Season" : "Tournament"}</h2>
        <div className="cricket-tour-fields">
          {addingSeason && (
            <button type="button" className="cricket-picker-item cricket-select-field" onClick={() => setChoosingSeries(true)}>
              {picked ? (
                <TournamentLogo tournament={picked.last} className="cricket-picker-avatar" />
              ) : (
                <span className="cricket-picker-avatar cricket-stage-icon">
                  <i className="fa-solid fa-layer-group" aria-hidden="true"></i>
                </span>
              )}
              <span className="cricket-picker-text">
                <strong>{picked ? picked.name : "Choose the tournament"}</strong>
                <small>
                  {picked
                    ? `${picked.count} season${picked.count === 1 ? "" : "s"} so far · last: ${picked.lastSeason}`
                    : "From the ones you organise"}
                </small>
              </span>
              <i className="fa-solid fa-chevron-down cricket-app-row-chevron" aria-hidden="true"></i>
            </button>
          )}
          {addingSeason && errors.name && !picked && <small className="text-danger">Choose the tournament first</small>}
          {choosingSeries && (
            <SeriesSheet series={series} pickedKey={picked?.key ?? null} onPick={pickSeries} onClose={() => setChoosingSeries(false)} />
          )}
          {picked ? (
            <InputComp
              label="Season name"
              required
              value={shownSeason}
              error={errors.name}
              maxLength={40}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setSeasonTouched(true);
                setSeason(e.target.value);
                clear("name");
              }}
            />
          ) : addingSeason ? null : existing && repeats ? (
            <>
              <InputComp
                label="Tournament name"
                required
                value={seriesName}
                error={errors.name}
                maxLength={100}
                {...seriesSuggest.inputProps}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setSeriesName(e.target.value);
                  setEditTouched(true);
                  clear("name");
                }}
              />
              {seriesSuggest.menu}
              <InputComp
                label="Season name"
                value={season}
                maxLength={40}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setSeason(e.target.value);
                  setEditTouched(true);
                }}
              />
            </>
          ) : (
            <InputComp
              label="Tournament name"
              required
              value={name}
              error={errors.name}
              maxLength={repeats ? 100 : 150}
              onChange={text(setName, "name")}
            />
          )}
          {!addingSeason && (
            <div className="cricket-app-group">
              <SwitchRow
                icon="fa-solid fa-layer-group"
                label="Runs in seasons"
                // What turning it on does, or what it means once on.
                note={
                  !repeats
                    ? "Turn on if you'll hold it again: Season 1, Season 2…"
                    : existing
                      ? "Kept together with its other seasons and their combined stats."
                      : "Starts as Season 1. Add later seasons from its page."
                }
                on={repeats}
                onChange={(on) => {
                  setRepeats(on);
                  // Editing a one-off into a season: start from its name.
                  if (existing && on) {
                    if (!seriesName.trim()) setSeriesName(name);
                    if (!season.trim()) setSeason("Season 1");
                    setEditTouched(true);
                  }
                }}
              />
            </div>
          )}
          {!existing && repeats && !addingSeason && (
            <InputComp
              label="First season name"
              value={shownSeason}
              maxLength={40}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setSeasonTouched(true);
                setSeason(e.target.value);
              }}
            />
          )}
          {isSeason && fullName.trim() && (
            <small className="admin-hint d-block">
              <i className="fa-regular fa-circle-check me-1" aria-hidden="true"></i>
              Will be called <strong>{fullName.trim()}</strong>
              {picked ? ". Venue, organiser and rules are copied from the last season." : "."}
            </small>
          )}
        </div>

        {/* 3. Where it's played. */}
        <h2 className="cricket-app-group-title">Venue</h2>
        <div className="cricket-tour-fields">
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

        {/* 4. Who runs it: the contact shown on it, and who else manages it. */}
        <h2 className="cricket-app-group-title">Organiser</h2>
        <div className="cricket-tour-fields">
          <small className="admin-hint d-block">
            {existing
              ? "The contact people see on the tournament."
              : "The contact people see. Creating it for someone else? Enter their details: they'll manage it with you."}
          </small>
          <div className="cricket-form-row">
            <InputComp
              label="Name"
              required
              value={organiserName}
              error={errors.organiserName}
              maxLength={100}
              onChange={text(setOrganiserName, "organiserName")}
            />
            <InputComp
              label="Mobile number"
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
            label="Email (optional)"
            type="email"
            value={organiserEmail}
            error={errors.organiserEmail}
            maxLength={150}
            onChange={text(setOrganiserEmail, "organiserEmail")}
          />
          {!existing && (
            <button type="button" className="cricket-add-row" onClick={() => setEditingCoOrganisers(true)}>
              <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
              <span>
                <strong>
                  {coOrganisers.length === 0
                    ? "Add co-organisers"
                    : `${coOrganisers.length} co-organiser${coOrganisers.length === 1 ? "" : "s"}`}
                </strong>
                <small>
                  {coOrganisers.length === 0
                    ? "Optional · people who manage it with you"
                    : coOrganisers.map((p) => p.name).join(", ")}
                </small>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          )}
          {editingCoOrganisers && (
            <CoOrganisersSheet value={coOrganisers} onChange={setCoOrganisers} onClose={() => setEditingCoOrganisers(false)} />
          )}
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
                Suggested: {Math.ceil(Number(overs) / 5)} {Math.ceil(Number(overs) / 5) === 1 ? "over" : "overs"} per bowler —{" "}
                <button
                  type="button"
                  className="admin-link-btn"
                  onClick={() => setBowlerLimit(String(Math.ceil(Number(overs) / 5)))}
                >
                  Use this
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
            icon="fa-solid fa-right-left"
            label="Impact Player"
            note="Each side may swap one player for a substitute once"
            on={impactPlayer}
            onChange={setImpactPlayer}
          />
          <SwitchRow
            icon="fa-solid fa-bolt"
            label="Free hit on a no-ball"
            note="The next ball can only be out run out"
            on={freeHit}
            onChange={setFreeHit}
          />
          <SwitchRow
            icon="fa-solid fa-gauge-high"
            label="Powerplay"
            note={hasPowerplay ? "Its overs at the start of each innings" : "No powerplay in its matches"}
            on={hasPowerplay}
            onChange={(on) => {
              setHasPowerplay(on);
              clear("powerplayOvers");
              // The usual share: 6 of 20, 15 of 50.
              if (on && !powerplayOvers) setPowerplayOvers(String(Math.max(1, Math.round((Number(overs) || 20) * 0.3))));
            }}
          />
          {hasPowerplay && (
            <label className="cricket-app-row">
              <span className="cricket-app-row-label">
                <i className="fa-solid fa-hashtag" aria-hidden="true"></i> Powerplay overs
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={powerplayOvers}
                onChange={text(setPowerplayOvers, "powerplayOvers")}
              />
            </label>
          )}
          {errors.powerplayOvers && (
            <div className="cricket-app-row is-hint">
              <small className="text-danger">{errors.powerplayOvers}</small>
            </div>
          )}
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
