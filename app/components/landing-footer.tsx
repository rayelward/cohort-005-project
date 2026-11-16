import { Link } from "react-router";

const linkClass =
  "text-sm text-muted-foreground transition-colors hover:text-foreground";

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold tracking-tight">Cadence</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Learn to code, at your own pace.
          </p>
        </div>
        <nav className="flex gap-6">
          <Link to="/courses" className={linkClass}>
            Courses
          </Link>
          {signedIn ? (
            <Link to="/dashboard" className={linkClass}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={linkClass}>
                Log In
              </Link>
              <Link to="/signup" className={linkClass}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
