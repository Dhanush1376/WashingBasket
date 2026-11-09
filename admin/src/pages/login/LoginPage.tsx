import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import heroPoster from '@customer-assets/video/washing-basket-hero-poster.jpg';
import heroVideo from '@customer-assets/video/washing-basket-hero.mp4';
import { LoadingOverlay } from '@/components/brand/BrandMotion';
import { BrandLogo, Wordmark } from '@/components/brand/LogoLayers';
import { Checkbox } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { isSignedIn, signIn } from '@/lib/demoAuth';

const DEMO_EMAIL = 'admin@washingbasket.demo';
const DEMO_PASSWORD = 'demo-admin';

/** Only paths inside the portal, never another site. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

/**
 * Demo sign-in for the admin portal: the customer app's sign-in film on the left, the form on the right.
 * Any email and password open the portal; nothing is checked or sent anywhere.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { show } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // the film starts once it can; it stays on the poster frame when motion is reduced
  const video = useRef<HTMLVideoElement>(null);
  const [filmReady, setFilmReady] = useState(false);
  useEffect(() => {
    const v = video.current;
    if (!v || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    v.play().catch(() => {});
  }, []);

  if (isSignedIn() && !opening) return <Navigate to={next} replace />;

  const emailError = touched && !email.trim();
  const passwordError = touched && !password;
  const error = emailError && passwordError ? 'Enter your email and password.' : emailError ? 'Enter your email.' : passwordError ? 'Enter your password.' : null;

  const open = () => {
    setBusy(true);
    // a short beat on the button, then the brand loader while the portal opens
    timers.current.push(
      window.setTimeout(() => {
        signIn(remember);
        setOpening(true);
      }, 500),
      window.setTimeout(() => navigate(next, { replace: true }), 1700),
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!email.trim() || !password || busy) return;
    open();
  };

  // demo: fills in sample details and signs straight in (any details work anyway)
  const openDemo = () => {
    if (busy) return;
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setTouched(false);
    open();
  };

  return (
    <div className="login">
      <section className="login__film" aria-label="Washing Basket">
        <img className="login__media" src={heroPoster} alt="" />
        <video
          ref={video}
          className={`login__media login__video${filmReady ? ' login__video--on' : ''}`}
          src={heroVideo}
          poster={heroPoster}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          onPlaying={() => setFilmReady(true)}
          aria-hidden
        />
        <div className="login__film-shade" />
        <div className="login__film-copy">
          <p className="login__film-line">Every pickup, wash and delivery, in one place.</p>
        </div>
      </section>

      <section className="login__panel">
        <header className="login__top">
          <div className="login__brand">
            <BrandLogo width={38} />
            <Wordmark className="login__wordmark" />
          </div>
          <button type="button" className="login__demo" onClick={openDemo} disabled={busy} title="Sign in with demo details">
            <Icon name="sparkle" size={14} />
            Demo
          </button>
        </header>

        <div className="login__center">
          <div className="login__card">
            <p className="login__eyebrow">Admin portal</p>
            <h1 className="login__title">Welcome back</h1>
            <p className="login__lead">Sign in to manage pickups, orders and customers.</p>

            <form className="login__form" onSubmit={submit} noValidate>
              <label className={`pill${emailError ? ' pill--error' : ''}`}>
                <input
                  className="pill__input"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="Email address"
                  aria-label="Email address"
                  aria-invalid={!!emailError}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={busy}
                  autoFocus
                />
                <span className="pill__divider" aria-hidden />
                <span className="pill__badge" aria-hidden>
                  <Icon name="mail" size={13} color="#FFFFFF" strokeWidth={2.3} />
                </span>
              </label>

              <label className={`pill${passwordError ? ' pill--error' : ''}`}>
                <input
                  className="pill__input"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  aria-label="Password"
                  aria-invalid={!!passwordError}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  readOnly={busy}
                />
                <span className="pill__divider" aria-hidden />
                <button
                  type="button"
                  className="pill__badge pill__badge--button"
                  onClick={() => setReveal((r) => !r)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  aria-pressed={reveal}
                >
                  <Icon name={reveal ? 'eyeOff' : 'eye'} size={13} color="#FFFFFF" strokeWidth={2.3} />
                </button>
              </label>

              <p className={`login__helper${error ? ' login__helper--error' : ''}`} role={error ? 'alert' : undefined}>
                {error ?? 'Use your work email and password.'}
              </p>

              <div className="login__row">
                <Checkbox checked={remember} onChange={setRemember} label="Keep me signed in" disabled={busy} />
                <button type="button" className="login__link" onClick={() => show('info', 'Password reset isn’t part of the demo', 'Any password works here.')}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="login__submit" disabled={busy} aria-busy={busy}>
                {busy ? <span className="spinner" aria-hidden /> : null}
                {busy ? 'Signing in' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <footer className="login__foot">© {new Date().getFullYear()} Washing Basket · Sample data only</footer>
      </section>

      <LoadingOverlay visible={opening} message="Opening the admin portal" />
    </div>
  );
}
