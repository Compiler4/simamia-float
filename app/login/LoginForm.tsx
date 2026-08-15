"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./login.module.css";

type LoginResponse = {
  success?: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
  redirectTo?: string;
};

type MaterialIconProps = {
  name: string;
  className?: string;
  filled?: boolean;
};

function MaterialIcon({
  name,
  className = "",
  filled = false,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-rounded ${styles.materialIcon} ${className}`}
      aria-hidden="true"
      style={{
        fontVariationSettings: filled
          ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 450, 'GRAD' 0, 'opsz' 24",
      }}
    >
      {name}
    </span>
  );
}

function readResponseMessage(
  body: LoginResponse,
  fallback: string,
): string {
  return (
    body.message?.trim() ||
    body.error?.trim() ||
    fallback
  );
}

function SimamiaLogo() {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <div
        className={styles.logoFallback}
        aria-label="Simamia Float"
      >
        <MaterialIcon name="payments" filled />
      </div>
    );
  }

  return (
    <Image
      src="/icons/icon-192x192.png"
      alt="Simamia Float"
      className={styles.logoImage}
      width={192}
      height={192}
      priority
      onError={() => setImageFailed(true)}
    />
  );
}

export default function LoginForm() {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    try {
      const rememberedEmail = window.localStorage.getItem(
        "simamia_remembered_email",
      );

      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRememberMe(true);
      }
    } catch {
      // Local storage may be blocked by the browser.
    }
  }, []);

  async function submitLogin(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (submittingRef.current || loading) {
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail) {
      setError("Enter your registered email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError("Use your registered email address, not a username.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanedEmail,
          password,
          rememberMe,
        }),
      });

      const rawBody = await response.text();
      let result: LoginResponse = {};

      try {
        result = rawBody
          ? (JSON.parse(rawBody) as LoginResponse)
          : {};
      } catch {
        throw new Error(
          `The login server returned status ${response.status} instead of valid JSON.`,
        );
      }

      if (
        !response.ok ||
        result.success === false ||
        result.ok === false
      ) {
        throw new Error(
          readResponseMessage(
            result,
            `Login failed with status ${response.status}.`,
          ),
        );
      }

      try {
        if (rememberMe) {
          window.localStorage.setItem(
            "simamia_remembered_email",
            cleanedEmail,
          );
        } else {
          window.localStorage.removeItem(
            "simamia_remembered_email",
          );
        }
      } catch {
        // Login can continue when storage is unavailable.
      }

      setSuccessMessage(
        result.message ||
          "Login successful. Opening your portal...",
      );

      router.replace(result.redirectTo || "/dashboard");
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Login could not be completed.",
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />

      <main className={styles.page}>
        <div className={styles.backgroundGrid} aria-hidden="true" />
        <div className={styles.backgroundGlowOne} aria-hidden="true" />
        <div className={styles.backgroundGlowTwo} aria-hidden="true" />

        <section className={styles.portalShell}>
          <div className={styles.shellHighlight} aria-hidden="true" />

          <section className={styles.visualSection}>
            <header className={styles.brandHeader}>
              <div className={styles.headerLogo}>
                <SimamiaLogo />
              </div>

              <div>
                <p className={styles.brandName}>SIMAMIA</p>
                <p className={styles.brandSubtitle}>FLOAT MANAGEMENT</p>
              </div>
            </header>

            <div className={styles.securityScene} aria-hidden="true">
              <div className={styles.floorShadow} />
              <div className={styles.outerOrbit} />
              <div className={styles.middleOrbit} />
              <div className={styles.innerOrbit} />
              <div className={styles.orbitLightOne} />
              <div className={styles.orbitLightTwo} />

              <div className={styles.centralPlatform}>
                <div className={styles.platformTop}>
                  <div className={styles.platformGlow} />
                  <div className={styles.centralLogo}>
                    <SimamiaLogo />
                  </div>
                </div>
                <div className={styles.platformBase} />
              </div>

              <div className={`${styles.featureNode} ${styles.nodePayments}`}>
                <span className={styles.nodePulse} />
                <MaterialIcon name="payments" filled />
                <small>Float</small>
              </div>

              <div className={`${styles.featureNode} ${styles.nodeSecurity}`}>
                <span className={styles.nodePulse} />
                <MaterialIcon name="verified_user" filled />
                <small>Secure</small>
              </div>

              <div className={`${styles.featureNode} ${styles.nodeAnalytics}`}>
                <span className={styles.nodePulse} />
                <MaterialIcon name="monitoring" filled />
                <small>Reports</small>
              </div>

              <div className={`${styles.featureNode} ${styles.nodeLocation}`}>
                <span className={styles.nodePulse} />
                <MaterialIcon name="location_on" filled />
                <small>GPS</small>
              </div>

              <div className={`${styles.featureNode} ${styles.nodePeople}`}>
                <span className={styles.nodePulse} />
                <MaterialIcon name="groups" filled />
                <small>Staff</small>
              </div>
            </div>

            <div className={styles.visualText}>
              <div className={styles.liveBadge}>
                <span />
                Protected company portal
              </div>

              <h1>
                Control every float operation from one secure platform.
              </h1>

              <p>
                Monitor transactions, brokers, attendance, accounting and GPS
                activity in real time.
              </p>
            </div>
          </section>

          <section className={styles.formSection}>
            <div className={styles.loginCard}>
              <div className={styles.mobileLogo}>
                <SimamiaLogo />
                <div>
                  <strong>SIMAMIA</strong>
                  <small>FLOAT APP</small>
                </div>
              </div>

              <header className={styles.formHeader}>
                <div className={styles.formIcon}>
                  <MaterialIcon name="shield_lock" filled />
                </div>

                <div>
                  <p className={styles.formEyebrow}>SECURE USER LOGIN</p>
                  <h2>Welcome back</h2>
                  <p>
                    Sign in to continue to your assigned Simamia portal.
                  </p>
                </div>
              </header>

              <form className={styles.form} onSubmit={submitLogin} noValidate>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Registered email</span>
                  <span className={styles.inputWrapper}>
                    <MaterialIcon
                      name="mail"
                      className={styles.inputIcon}
                    />
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (error) setError("");
                      }}
                      placeholder="name@company.com"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={loading}
                      required
                    />
                  </span>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Password</span>
                  <span className={styles.inputWrapper}>
                    <MaterialIcon
                      name="lock"
                      className={styles.inputIcon}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className={styles.visibilityButton}
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={loading}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <MaterialIcon
                        name={showPassword ? "visibility_off" : "visibility"}
                      />
                    </button>
                  </span>
                </label>

                <div className={styles.optionsRow}>
                  <label className={styles.rememberLabel}>
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      disabled={loading}
                    />
                    <span className={styles.customCheckbox}>
                      <MaterialIcon name="check" />
                    </span>
                    <span>Remember me</span>
                  </label>

                  <a className={styles.forgotLink} href="/forgot-password">
                    Forgot password?
                  </a>
                </div>

                {error && (
                  <div className={styles.errorMessage} role="alert">
                    <MaterialIcon name="error" filled />
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div className={styles.successMessage} role="status">
                    <MaterialIcon name="check_circle" filled />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={styles.loginButton}
                  disabled={loading}
                >
                  <span className={styles.buttonGlow} aria-hidden="true" />

                  {loading ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="login" />
                      <span>Sign in securely</span>
                      <MaterialIcon
                        name="arrow_forward"
                        className={styles.buttonArrow}
                      />
                    </>
                  )}
                </button>
              </form>

              <footer className={styles.cardFooter}>
                <MaterialIcon name="encrypted" />
                <span>Protected with encrypted authentication</span>
              </footer>
            </div>

            <p className={styles.copyright}>
              © {new Date().getFullYear()} Simamia Float. All rights reserved.
            </p>
          </section>
        </section>
      </main>
    </>
  );
}
