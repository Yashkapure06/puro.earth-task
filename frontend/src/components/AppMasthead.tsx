import { Link } from "react-router-dom";

type AppMastheadProps = {
  userName: string;
  onSignOut: () => void;
  signOutPending?: boolean;
  profileTo?: string;
};

export function AppMasthead({
  userName,
  onSignOut,
  signOutPending,
  profileTo,
}: AppMastheadProps) {
  return (
    <header className="mb-10 flex items-center justify-between gap-4">
      <p className="font-serif text-xl font-medium tracking-tight text-ink">
        Puro
      </p>
      <div className="flex items-center gap-4">
        <p className="hidden text-sm text-muted sm:block">{userName}</p>
        {profileTo ? (
          <Link
            to={profileTo}
            className="text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            Profile
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onSignOut}
          disabled={signOutPending}
          className="inline-flex h-10 cursor-pointer items-center rounded-sm border border-hairline px-4 text-sm font-medium text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          {signOutPending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
