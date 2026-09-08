import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser, useLogin } from "@/hooks/useBanking";
import { ApiRequestError } from "@/lib/api";
import { bankingErrorMessage } from "@/lib/banking-errors";

function homePath(role: string): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useCurrentUser();
  const login = useLogin();
  const [email, setEmail] = useState("yash@puro.earth.task.com");
  const [password, setPassword] = useState("demo-pass");
  const [error, setError] = useState<string | null>(null);

  if (!isLoading && !isError && user) {
    return <Navigate to={homePath(user.role)} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await login.mutateAsync({ email, password });
      navigate(homePath(result.user.role), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? bankingErrorMessage(err.code)
          : "Something went wrong. Try again",
      );
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink">
          Puro
        </h1>
        <p className="mt-2 text-sm text-muted">Sign in to your account.</p>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-center text-sm text-muted">
            New customer?{" "}
            <Link to="/register" className="text-ink underline-offset-4 hover:underline">
              Open an account
            </Link>
          </p>
          <p className="text-center text-xs text-muted">
            Demo: yash@puro.earth.task.com / demo-pass · admin@puro.earth.task.com / demo-pass
          </p>
        </form>
      </div>
    </main>
  );
}
