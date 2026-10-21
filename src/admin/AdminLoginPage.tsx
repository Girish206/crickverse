import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { NoCricketAccessError, useAdminAuth } from "../context/AdminAuthContext";
import InputComp from "./dms/components/InputComp";
import CustomButton from "./dms/components/CustomButton";
import { useAdminBodyClass } from "./useAdminBodyClass";
import { useAdminTheme } from "./useAdminTheme";
import "./dms/global.css";
import "./dms/css/Login.css";

// CrickVerse sign-in: players use the mobile number their organiser
// registered; organisers can also use their email.
export function AdminLoginPage() {
  useAdminBodyClass();
  useAdminTheme();
  const { login } = useAdminAuth();
  const navigate = useNavigate();

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
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof NoCricketAccessError ? err.message : "Invalid mobile number/email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-ash admin-login-ash-1" aria-hidden="true" />
      <div className="admin-login-ash admin-login-ash-2" aria-hidden="true" />

      <div className="admin-login-card animated fadeInUp">
        <div className="admin-login-logo-ring">
          <img src="/favicon.svg" alt="CrickVerse" className="admin-login-logo" />
        </div>

        <span className="admin-login-badge">CrickVerse</span>
        <h1 className="admin-login-heading">Welcome Back</h1>
        <p className="admin-login-subtitle">Every ball. Every stat. Sign in with your mobile number.</p>

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

        <p className="admin-login-footnote">
          <i className="fa-solid fa-baseball-bat-ball"></i> A Girish Creations project
        </p>
      </div>
    </div>
  );
}
