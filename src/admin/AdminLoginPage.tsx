import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { NoCricketAccessError, useAdminAuth } from "../context/AdminAuthContext";
import InputComp from "./dms/components/InputComp";
import CustomButton from "./dms/components/CustomButton";
import { AuthShell } from "./AuthShell";

// CricDesk sign-in: players use their mobile number; organisers can also
// use their email. Signing in once keeps them signed in on this device.
export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  // The page they were sent here from (a shared link), only ever in-app.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") && !from.startsWith("//") ? from : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(backTo, { replace: true });
    } catch (err) {
      // Added to a team by an organiser, but no password yet: go set one.
      if (isAxiosError(err) && err.response?.data?.error?.code === "NO_PASSWORD") {
        navigate(`/register?mobile=${encodeURIComponent(email.trim())}&setPassword=1`);
        return;
      }
      setError(err instanceof NoCricketAccessError ? err.message : "Invalid mobile number/email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      heading="Welcome Back"
      subtitle="Every ball. Every stat. Sign in with your mobile number."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="admin-login-form">
        {error && <div className="alert alert-danger py-2 text-center">{error}</div>}

        <InputComp
          type="text"
          name="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          floating={true}
          required
          icon="fa-solid fa-mobile-screen"
          iconPosition="right"
          label="Mobile number or email"
        />

        <InputComp
          type={showPassword ? "text" : "password"}
          name="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          floating={true}
          required
          icon={`fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`}
          iconPosition="right"
          iconOnClick={() => setShowPassword((prev) => !prev)}
        />

        <CustomButton
          type="submit"
          rounded={true}
          className="w-100 mt-3"
          disabled={loading}
          loading={loading}
          loadingLabel="Signing in..."
        >
          Sign In <i className="fa-solid fa-arrow-right ms-2"></i>
        </CustomButton>
      </form>
    </AuthShell>
  );
}
