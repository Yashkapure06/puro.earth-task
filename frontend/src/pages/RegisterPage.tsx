import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser, useRegister } from "@/hooks/useBanking";
import { ApiRequestError } from "@/lib/api";
import { bankingErrorMessage } from "@/lib/banking-errors";

export function RegisterPage() {
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useCurrentUser();
  const register = useRegister();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isLoading && !isError && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({ name, email, password });
      navigate("/dashboard", { replace: true });
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
          Open an account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Puro issues a sort code, account number, and debit card last-four.
          These values are generated for this assessment, not a real bank.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={register.isPending}>
            {register.isPending ? "Opening…" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-ink underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
