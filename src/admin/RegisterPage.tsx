import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { messageFor } from "../api/mutationErrors";
import { normalizeMobile } from "./cricket/mobile";
import InputComp from "./dms/components/InputComp";
import CustomButton from "./dms/components/CustomButton";
import { AuthShell } from "./AuthShell";

// Players sign themselves up with their name, mobile number and a password.
// If their organiser already added them, the same mobile number links the
// account to that player and their stats.
export function RegisterPage() {
  const { register } = useAdminAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your name";
    if (!normalizeMobile(mobile)) next.mobile = "Enter a valid 10-digit mobile number";
    if (password.length < 8) next.password = "Use at least 8 characters";
    if (confirm !== password) next.confirm = "The passwords don't match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await register({ name: name.trim(), mobile: normalizeMobile(mobile)!, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      heading="Create Account"
      subtitle="Join in — track your runs, wickets and every match you play."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="admin-login-form">
        {error && <div className="alert alert-danger py-2 text-center">{error}</div>}

        <InputComp
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          floating={true}
          required
          icon="fa-solid fa-user"
          iconPosition="right"
          label="Full name"
          error={errors.name}
        />

        <InputComp
          type="tel"
          name="mobile"
          autoComplete="tel"
          inputMode="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          floating={true}
          required
          icon="fa-solid fa-mobile-screen"
          iconPosition="right"
          label="Mobile number"
          error={errors.mobile}
        />

        <InputComp
          type={showPassword ? "text" : "password"}
          name="password"
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          floating={true}
          required
          icon={`fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`}
          iconPosition="right"
          iconOnClick={() => setShowPassword((prev) => !prev)}
          error={errors.password}
        />

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

        <CustomButton
          type="submit"
          rounded={true}
          className="w-100 mt-3"
          disabled={loading}
          loading={loading}
          loadingLabel="Creating account..."
        >
          Create Account <i className="fa-solid fa-arrow-right ms-2"></i>
        </CustomButton>
      </form>
    </AuthShell>
  );
}
