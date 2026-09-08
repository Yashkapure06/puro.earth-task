import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AppMasthead } from "@/components/AppMasthead";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminCustomers,
  useCloseCustomer,
  useCreateCustomer,
  useCurrentUser,
  useLogout,
  useUpdateCustomer,
} from "@/hooks/useBanking";
import { ApiRequestError } from "@/lib/api";
import { bankingErrorMessage } from "@/lib/banking-errors";
import type { AdminCustomer } from "@/types/api";

export function AdminPage() {
  const navigate = useNavigate();
  const userQuery = useCurrentUser();
  const customersQuery = useAdminCustomers(userQuery.data?.role === "admin");
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const closeCustomer = useCloseCustomer();
  const logout = useLogout();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [closing, setClosing] = useState<AdminCustomer | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (userQuery.isLoading) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return <Navigate to="/login" replace />;
  }

  if (userQuery.data.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Session is cleared client-side even if the network call fails.
    }
    navigate("/login", { replace: true });
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createCustomer.mutateAsync({ name, email, password });
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? bankingErrorMessage(err.code)
          : "Something went wrong. Try again",
      );
    }
  };

  const openEdit = (customer: AdminCustomer) => {
    setEditing(customer);
    setEditName(customer.name);
    setEditEmail(customer.email);
    setDialogError(null);
  };

  const onEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setDialogError(null);
    try {
      await updateCustomer.mutateAsync({
        id: editing.id,
        name: editName,
        email: editEmail,
      });
      setEditing(null);
    } catch (err) {
      setDialogError(
        err instanceof ApiRequestError
          ? bankingErrorMessage(err.code)
          : "Something went wrong. Try again",
      );
    }
  };

  const onCloseAccount = async () => {
    if (!closing) return;
    setDialogError(null);
    try {
      await closeCustomer.mutateAsync(closing.id);
      setClosing(null);
    } catch (err) {
      setDialogError(
        err instanceof ApiRequestError
          ? bankingErrorMessage(err.code)
          : "Something went wrong. Try again",
      );
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-[880px] px-4 py-8 md:py-12">
      <AppMasthead
        userName={userQuery.data.name}
        onSignOut={handleLogout}
        signOutPending={logout.isPending}
      />

      <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">
        Customers
      </h1>
      <p className="mt-2 text-sm text-muted">
        Open, edit, or close customer current accounts. Closing keeps the
        ledger. You cannot move their money.
      </p>

      <form onSubmit={onCreate} className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="off"
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
          <p role="alert" className="sm:col-span-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Creating…" : "Create customer"}
          </Button>
        </div>
      </form>

      <div className="mt-10 overflow-x-auto">
        {customersQuery.isLoading ? (
          <p className="text-sm text-muted">Loading customers…</p>
        ) : customersQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load customers.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Customers</caption>
            <thead>
              <tr className="border-b border-hairline text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Sort code</th>
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {(customersQuery.data ?? []).map((customer) => (
                <tr key={customer.id} className="border-b border-hairline">
                  <td className="py-3 pr-4">{customer.name}</td>
                  <td className="py-3 pr-4">{customer.email}</td>
                  <td className="py-3 pr-4 tabular-nums">{customer.sortCode}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {customer.accountNumber}
                  </td>
                  <td className="py-3 pr-4 capitalize">{customer.status}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-2"
                      onClick={() => openEdit(customer)}
                    >
                      Edit
                    </Button>
                    {customer.status === "open" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-2"
                        onClick={() => {
                          setClosing(customer);
                          setDialogError(null);
                        }}
                      >
                        Close
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <form onSubmit={onEdit}>
            <DialogHeader>
              <DialogTitle>Edit customer</DialogTitle>
              <DialogDescription>
                Name and email only. Sort code and account number stay issued.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                />
              </div>
              {dialogError && editing ? (
                <p role="alert" className="text-sm text-destructive">
                  {dialogError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closing !== null}
        onOpenChange={(open) => {
          if (!open) setClosing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close account</DialogTitle>
            <DialogDescription>
              {closing
                ? `Close ${closing.name}’s current account? Money movement stops. History is kept.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {dialogError && closing ? (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setClosing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onCloseAccount();
              }}
              disabled={closeCustomer.isPending}
            >
              {closeCustomer.isPending ? "Closing…" : "Close account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
