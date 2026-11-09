import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { NoCricketAccessError, useAdminAuth } from "../context/AdminAuthContext";
import { apiClient } from "../api/client";
import type { ApiEnvelope } from "../api/types";
import { messageFor } from "../api/mutationErrors";
import { formatMobile, normalizeMobile } from "./cricket/mobile";
import { PRIVACY_URL, TERMS_URL } from "./cricket/legalLinks";
import InputComp from "./dms/components/InputComp";
import CustomButton from "./dms/components/CustomButton";
import { AuthShell } from "./AuthShell";
import { SignUpCaptcha, type Captcha } from "./SignUpCaptcha";

// What the API says comes after "Next" (runmitra-api lookupSignIn).
// "code" and "reset" come from the password step: an emailed code to sign in
// with, or to set a new password with. "verifyEmail" comes after joining with
// an email: the code the API sent to confirm it, before the account is made.
// "captcha" comes after Create Account with no email, in its place.
type Step = "identify" | "password" | "setPassword" | "register" | "code" | "reset" | "verifyEmail" | "captcha";
type JoinStep = "setPassword" | "register";

const COPY: Record<Step, { heading: string; subtitle: string; submit: string; loading: string }> = {
  identify: {
    heading: "Welcome to RunMitra",
    subtitle: "Every ball. Every stat. Enter your email or mobile number to get started.",
    submit: "Next",
    loading: "Checking...",
  },
  password: {
    heading: "Welcome Back",
    subtitle: "Enter your password to sign in.",
    submit: "Sign In",
    loading: "Signing in...",
  },
  setPassword: {
    heading: "Set Password",
    subtitle: "You've been added to a team. Enter the invite code your organiser sent and set a password.",
    submit: "Set Password",
    loading: "Saving...",
  },
  code: {
    heading: "Check Your Email",
    subtitle: "Enter the code we sent to sign in.",
    submit: "Verify and Sign In",
    loading: "Verifying...",
  },
  reset: {
    heading: "Reset Password",
    subtitle: "Enter the code we sent and choose a new password.",
    submit: "Set Password and Sign In",
    loading: "Saving...",
  },
  register: {
    heading: "Create Account",
    subtitle: "Join in — track your runs, wickets and every match you play.",
    // Always a second step: the email's code, or the captcha.
    submit: "Continue",
    loading: "Sending code...",
  },
  verifyEmail: {
    heading: "Confirm Your Email",
    subtitle: "Enter the code we sent to your email to finish creating your account.",
    submit: "Verify and Create Account",
    loading: "Creating account...",
  },
  captcha: {
    heading: "One Last Step",
    subtitle: "Type the characters in the picture to finish creating your account.",
    submit: "Create Account",
    loading: "Creating account...",
  },
};

// Under the first step's button, what the app is for.
const PERKS = [
  { icon: "fa-baseball-bat-ball", title: "Live scoring", detail: "Ball by ball" },
  { icon: "fa-chart-line", title: "Your stats", detail: "Runs and wickets" },
  { icon: "fa-trophy", title: "MVP points", detail: "Every match" },
];

// RunMitra sign-in and sign-up on one screen: the email or mobile number
// first, then a password for an existing account, the invite code and a new
// password for a team-added player who has none yet (the code proves the
// number is theirs), or name and password for a new number. Both ways of
// joining can add an email, which sign-in codes need; it's confirmed with a
// code emailed to it before the account is made. A new number with no email
// solves a captcha on that next screen instead. Signing in once keeps them
// signed in on this device.
export function AdminLoginPage() {
  const { login, loginWithCode, resetPassword, register } = useAdminAuth();
  const navigate = useNavigate();
  // The page they were sent here from (a shared link), only ever in-app.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") && !from.startsWith("//") ? from : "/";

  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  // The six digits the organiser who added them shared (set-password step).
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The emailed code, the masked address it went to, and the resend countdown.
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Which way they were joining when asked for the email's code or the captcha.
  const [joinedVia, setJoinedVia] = useState<JoinStep>("register");
  // The captcha step: the picture, what they typed, and whether asking for a
  // picture is under way or failed.
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  // Only the latest request's picture is shown.
  const captchaRequest = useRef(0);

  const mobile = normalizeMobile(identifier);
  const copy = COPY[step];
  const usesCode = step === "code" || step === "reset" || step === "verifyEmail";
  const joining = step === "setPassword" || step === "register";
  const setsPassword = joining || step === "reset";
  // After the sign-up form, before the account is made.
  const confirming = step === "verifyEmail" || step === "captcha";

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // A fresh picture: each one works for a single try.
  async function loadCaptcha() {
    const request = ++captchaRequest.current;
    setCaptcha(null);
    setCaptchaAnswer("");
    setCaptchaFailed(false);
    setCaptchaLoading(true);
    try {
      const { data } = await apiClient.get<ApiEnvelope<Captcha>>("/admin/cricket/sign-up/captcha");
      if (request === captchaRequest.current) setCaptcha(data.data);
    } catch {
      if (request === captchaRequest.current) setCaptchaFailed(true);
    } finally {
      if (request === captchaRequest.current) setCaptchaLoading(false);
    }
  }

  // Create Account with no email: a new number has nothing else to show a
  // person is signing up, so the captcha comes next. (Claiming an invite has
  // the organiser's code, so it needs neither.)
  function askForCaptcha() {
    setJoinedVia("register");
    setErrors({});
    setStep("captcha");
    void loadCaptcha();
  }

  function goTo(next: Step) {
    setStep(next);
    setPassword("");
    setConfirm("");
    setErrors({});
    setError("");
  }

  function validate() {
    const next: Record<string, string> = {};
    if (step === "identify" && !identifier.includes("@") && !mobile)
      next.identifier = "Enter your email or 10-digit mobile number";
    if (step === "password" && !password) next.password = "Enter your password";
    if (step === "register" && name.trim().length < 2) next.name = "Enter your name";
    if (joining && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (step === "setPassword" && !/^\d{6}$/.test(inviteCode.trim())) next.inviteCode = "Enter the 6-digit invite code";
    if (usesCode && !/^\d{6}$/.test(code)) next.code = "Enter the 6-digit code";
    if (step === "captcha" && !captcha) next.captcha = "Wait for the picture, or tap the arrow for a new one";
    else if (step === "captcha" && !captchaAnswer.trim()) next.captcha = "Type the characters in the picture";
    if (setsPassword) {
      if (password.length < 8) next.password = "Use at least 8 characters";
      if (confirm !== password) next.confirm = "The passwords don't match";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function lookup() {
    const { data } = await apiClient.post<ApiEnvelope<{ step: Exclude<Step, "identify"> }>>(
      "/admin/cricket/sign-in/lookup",
      { identifier: identifier.trim() },
    );
    goTo(data.data.step);
  }

  async function signIn() {
    try {
      await login(identifier, password);
      navigate(backTo, { replace: true });
    } catch (err) {
      // Added to a team by an organiser, but no password yet: set one.
      if (isAxiosError(err) && err.response?.data?.error?.code === "NO_PASSWORD") {
        goTo("setPassword");
        return;
      }
      setError(err instanceof NoCricketAccessError ? err.message : messageFor(err));
    }
  }

  // Emails a code, then moves to where it's entered. A number with no email
  // on its account stays put, with the server saying who can help instead.
  async function sendCode(next: "code" | "reset") {
    setError("");
    setLoading(true);
    try {
      const { data } = await apiClient.post<ApiEnvelope<{ sentTo: string; resendInSeconds: number }>>(
        "/admin/auth/otp/request",
        { app: "cricket", email: identifier.trim(), purpose: next === "reset" ? "reset" : "login" },
      );
      setSentTo(data.data.sentTo);
      setResendIn(data.data.resendInSeconds);
      setCode("");
      if (step !== next) goTo(next);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }

  // Sends the sign-up form. With an email but no code yet, the API emails the
  // code instead of making the account, and it's asked for next; sent again
  // with it, the account is made and they're signed in.
  async function join(emailCode?: string) {
    const via = confirming ? joinedVia : (step as JoinStep);
    const toVerify = await register({
      name: via === "register" ? name.trim() : undefined,
      mobile: mobile!,
      email: email.trim() || undefined,
      emailCode,
      password,
      inviteCode: via === "setPassword" ? inviteCode.trim() : undefined,
      captchaId: step === "captcha" ? captcha?.captchaId : undefined,
      captchaAnswer: step === "captcha" ? captchaAnswer.trim() : undefined,
    });
    if (!toVerify) {
      navigate(backTo, { replace: true });
      return;
    }
    setJoinedVia(via);
    setSentTo(toVerify.sentTo);
    setResendIn(toVerify.resendInSeconds);
    setCode("");
    setErrors({});
    setStep("verifyEmail");
  }

  async function resendSignUpCode() {
    setError("");
    setLoading(true);
    try {
      await join();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }

  // Back to the form they filled in, keeping what they typed.
  function changeDetails() {
    setStep(joinedVia);
    setErrors({});
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (step === "identify") await lookup();
      else if (step === "password") await signIn();
      else if (step === "code") {
        await loginWithCode(identifier, code);
        navigate(backTo, { replace: true });
      } else if (step === "reset") {
        await resetPassword(identifier, code, password);
        navigate(backTo, { replace: true });
      } else if (step === "register" && !email.trim()) {
        askForCaptcha();
      } else {
        await join(step === "verifyEmail" ? code : undefined);
      }
    } catch (err) {
      setError(err instanceof NoCricketAccessError ? err.message : messageFor(err));
      // The picture may be used up now, so they get a new one either way.
      if (step === "captcha") void loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  const passwordIcon = `fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`;
  const togglePassword = () => setShowPassword((prev) => !prev);

  return (
    <AuthShell heading={copy.heading} subtitle={copy.subtitle} longForm={step !== "identify" && step !== "password"}>
      <form onSubmit={handleSubmit} noValidate className="admin-login-form">
        {error && <div className="alert alert-danger admin-login-error text-center">{error}</div>}

        {step === "identify" ? (
          <InputComp
            type="text"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            floating={true}
            required
            icon={`fa-solid ${identifier.includes("@") ? "fa-envelope" : "fa-mobile-screen"}`}
            iconPosition="right"
            label="Email or mobile number"
            error={errors.identifier}
          />
        ) : (
          <div className="admin-login-identity">
            <i className={`fa-solid ${mobile ? "fa-mobile-screen" : "fa-envelope"}`}></i>
            <span className="admin-login-identity-value">{mobile ? formatMobile(mobile) : identifier.trim()}</span>
            <button type="button" className="admin-login-identity-change" onClick={() => goTo("identify")}>
              Change
            </button>
            {/* Lets the browser's password manager pair the password with it. */}
            <input type="hidden" name="email" autoComplete="username" value={identifier.trim()} />
          </div>
        )}

        {step === "register" && (
          <InputComp
            type="text"
            name="name"
            autoComplete="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            floating={true}
            required
            icon="fa-solid fa-user"
            iconPosition="right"
            label="Full name"
            error={errors.name}
          />
        )}

        {step === "setPassword" && (
          <InputComp
            type="text"
            name="inviteCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, ""))}
            floating={true}
            required
            icon="fa-solid fa-key"
            iconPosition="right"
            label="Invite code"
            error={errors.inviteCode}
          />
        )}

        {joining && (
          <>
            <InputComp
              type="email"
              name="signupEmail"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              floating={true}
              icon="fa-solid fa-envelope"
              iconPosition="right"
              label="Email (optional)"
              error={errors.email}
            />
            <p className="admin-login-note mt-0 mb-2">
              Add your email to sign in with a code. We'll email you a code to confirm it.
            </p>
          </>
        )}

        {usesCode && (
          <>
            <p className="admin-login-hint mt-0 mb-2">
              Code sent to {sentTo} (valid 10 min)
            </p>
            <InputComp
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              floating={true}
              required
              icon="fa-solid fa-key"
              iconPosition="right"
              label="6-digit code"
              error={errors.code}
            />
          </>
        )}

        {step !== "identify" && step !== "code" && !confirming && (
          <InputComp
            key={step}
            type={showPassword ? "text" : "password"}
            name="password"
            label={step === "password" ? "Password" : step === "reset" ? "New password" : "Create a password"}
            autoComplete={step === "password" ? "current-password" : "new-password"}
            autoFocus={step === "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            floating={true}
            required
            icon={passwordIcon}
            iconPosition="right"
            iconOnClick={togglePassword}
            error={errors.password}
          />
        )}

        {setsPassword && (
          <InputComp
            type={showPassword ? "text" : "password"}
            name="confirm"
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            floating={true}
            required
            icon="fa-solid fa-lock"
            iconPosition="right"
            error={errors.confirm}
          />
        )}

        {step === "captcha" && (
          <SignUpCaptcha
            captcha={captcha}
            failed={captchaFailed}
            onRefresh={() => void loadCaptcha()}
            value={captchaAnswer}
            onChange={setCaptchaAnswer}
            error={errors.captcha}
            disabled={loading || captchaLoading}
          />
        )}

        <CustomButton
          type="submit"
          rounded={true}
          className="w-100 mt-3"
          disabled={loading}
          loading={loading}
          loadingLabel={copy.loading}
        >
          {copy.submit} <i className="fa-solid fa-arrow-right ms-2"></i>
        </CustomButton>

        {step === "identify" && (
          <>
            <p className="admin-login-note">New here? Enter your mobile number to sign up.</p>
            <ul className="admin-login-perks">
              {PERKS.map(({ icon, title, detail }) => (
                <li key={title}>
                  <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === "password" && (
          <div className="admin-login-links">
            <button type="button" disabled={loading} onClick={() => sendCode("reset")}>
              Forgot password?
            </button>
            <button type="button" disabled={loading} onClick={() => sendCode("code")}>
              Email me a code
            </button>
          </div>
        )}
        {step === "captcha" && (
          <div className="admin-login-links">
            <button type="button" disabled={loading} onClick={changeDetails}>
              Change details
            </button>
          </div>
        )}
        {usesCode && (
          <div className="admin-login-links">
            {step === "verifyEmail" ? (
              <button type="button" disabled={loading} onClick={changeDetails}>
                Change details
              </button>
            ) : (
              <button type="button" onClick={() => goTo("password")}>
                Use my password
              </button>
            )}
            <button
              type="button"
              disabled={loading || resendIn > 0}
              onClick={() => (step === "verifyEmail" ? resendSignUpCode() : sendCode(step === "reset" ? "reset" : "code"))}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        )}
        {step === "reset" && (
          <p className="admin-login-hint">Setting a new password signs you out on your other devices.</p>
        )}
        {step === "setPassword" && (
          <p className="admin-login-hint">No code? Ask the organiser or captain who added you to send your invite.</p>
        )}
        {(joining || confirming) && (
          <p className="admin-login-note admin-login-legal">
            By continuing, you agree to RunMitra's{" "}
            <a href={TERMS_URL} target="_blank" rel="noopener">
              Terms &amp; Conditions
            </a>{" "}
            and{" "}
            <a href={PRIVACY_URL} target="_blank" rel="noopener">
              Privacy Policy
            </a>
            .
          </p>
        )}
      </form>
    </AuthShell>
  );
}
