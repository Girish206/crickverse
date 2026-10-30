import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { NoCricketAccessError, useAdminAuth } from "../context/AdminAuthContext";
import { apiClient } from "../api/client";
import type { ApiEnvelope } from "../api/types";
import { messageFor } from "../api/mutationErrors";
import { formatMobile, normalizeMobile } from "./cricket/mobile";
import InputComp from "./dms/components/InputComp";
import CustomButton from "./dms/components/CustomButton";
import { AuthShell } from "./AuthShell";

// What the API says comes after "Next" (portfolio-server lookupSignIn).
type Step = "identify" | "password" | "setPassword" | "register";

const COPY: Record<Step, { heading: string; subtitle: string; submit: string; loading: string }> = {
  identify: {
    heading: "Welcome to RunMitra",
    subtitle: "Every ball. Every stat. Enter your mobile number to get started.",
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
  register: {
    heading: "Create Account",
    subtitle: "Join in — track your runs, wickets and every match you play.",
    submit: "Create Account",
    loading: "Creating account...",
  },
};

// RunMitra sign-in and sign-up on one screen: the mobile number first (the
// field says so, but an organiser's email works there too), then a password
// for an existing account, the invite code and a new password for a
// team-added player who has none yet (the code proves the number is theirs),
// or name and password for a new number. Signing in once keeps them signed
// in on this device.
export function AdminLoginPage() {
  const { login, register } = useAdminAuth();
  const navigate = useNavigate();
  // The page they were sent here from (a shared link), only ever in-app.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") && !from.startsWith("//") ? from : "/";

  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  // The six digits the organiser who added them shared (set-password step).
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mobile = normalizeMobile(identifier);
  const copy = COPY[step];

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
      next.identifier = "Enter a valid 10-digit mobile number";
    if (step === "password" && !password) next.password = "Enter your password";
    if (step === "register" && name.trim().length < 2) next.name = "Enter your name";
    if (step === "setPassword" && !/^\d{6}$/.test(inviteCode.trim())) next.inviteCode = "Enter the 6-digit invite code";
    if (step === "setPassword" || step === "register") {
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
      const tooMany = isAxiosError(err) && err.response?.status === 429;
      setError(err instanceof NoCricketAccessError || tooMany ? messageFor(err) : "That password isn't right.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (step === "identify") await lookup();
      else if (step === "password") await signIn();
      else {
        await register({
          name: step === "register" ? name.trim() : undefined,
          mobile: mobile!,
          password,
          inviteCode: step === "setPassword" ? inviteCode.trim() : undefined,
        });
        navigate(backTo, { replace: true });
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }

  const passwordIcon = `fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`;
  const togglePassword = () => setShowPassword((prev) => !prev);

  return (
    <AuthShell heading={copy.heading} subtitle={copy.subtitle}>
      <form onSubmit={handleSubmit} noValidate className="admin-login-form">
        {error && <div className="alert alert-danger py-2 text-center">{error}</div>}

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
            label="Mobile number"
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

        {step !== "identify" && (
          <InputComp
            key={step}
            type={showPassword ? "text" : "password"}
            name="password"
            label={step === "password" ? "Password" : "Create a password"}
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

        {(step === "setPassword" || step === "register") && (
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

        {step === "password" && (
          <p className="admin-login-hint">Forgot your password? Ask your organiser to reset it — they'll send you a new invite code.</p>
        )}
        {step === "setPassword" && (
          <p className="admin-login-hint">No code? Ask the organiser or captain who added you to send your invite.</p>
        )}
      </form>
    </AuthShell>
  );
}
