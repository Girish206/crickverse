import InputComp from "./dms/components/InputComp";

// A captcha picture from the API (runmitra-api auth/captcha.ts).
export interface Captcha {
  captchaId: string;
  // A PNG data URL.
  image: string;
  width: number;
  height: number;
}

interface Props {
  captcha: Captcha | null;
  // Asking for a picture failed (offline, say): the refresh button retries.
  failed: boolean;
  onRefresh: () => void;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

// What a new player who gives no email solves after Create Account, where
// one with an email enters the code sent to it, until mobile numbers are
// checked by SMS. Each picture works once, so the sign-in page asks for a
// new one after any failed try.
export function SignUpCaptcha({ captcha, failed, onRefresh, value, onChange, error, disabled }: Props) {
  return (
    <div className="signup-captcha">
      <div className="signup-captcha-picture">
        {captcha ? (
          <img src={captcha.image} width={captcha.width} height={captcha.height} alt="Characters to type" />
        ) : (
          <span className="signup-captcha-placeholder">{failed ? "Couldn't load the picture" : "Loading..."}</span>
        )}
        <button
          type="button"
          className="signup-captcha-refresh"
          onClick={onRefresh}
          disabled={disabled}
          aria-label="Show a different picture"
          title="Show a different picture"
        >
          <i className="fa-solid fa-rotate-right"></i>
        </button>
      </div>
      <InputComp
        type="text"
        name="captcha"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={10}
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        floating={true}
        required
        icon="fa-solid fa-shield-halved"
        iconPosition="right"
        label="Characters in the picture"
        error={error}
      />
    </div>
  );
}
