import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type {
  Account,
  AdminCustomer,
  Payee,
  Transaction,
  User,
} from "../types/api";

/**
 * Server state for the statement. After money mutations, invalidate
 * account + transactions so the balance and ledger match.
 */
export const queryKeys = {
  me: ["me"] as const,
  account: ["account"] as const,
  transactions: ["transactions"] as const,
  customers: ["customers"] as const,
};

export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<User>("/api/me"),
    enabled,
    retry: false,
  });
}

export function useAccount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.account,
    queryFn: () => apiFetch<Account>("/api/accounts/me"),
    enabled,
  });
}

export function useTransactions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: async () => {
      const data = await apiFetch<{ transactions: Transaction[] }>(
        "/api/transactions",
      );
      return data.transactions;
    },
    enabled,
  });
}

/** Confirm payee name from sort code + account number. Does not return account ids. */
export function useLookupPayee() {
  return useMutation({
    mutationFn: (input: { sortCode: string; accountNumber: string }) =>
      apiFetch<Payee>("/api/transfers/preview", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

function useInvalidateBankingQueries() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.account }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    ]);
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      apiFetch<{ user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>("/api/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

export function useDeposit() {
  const invalidate = useInvalidateBankingQueries();
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch<{ account: Account }>("/api/accounts/me/deposit", {
        method: "POST",
        body: JSON.stringify({ amount, currency: "GBP" }),
      }),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useWithdraw() {
  const invalidate = useInvalidateBankingQueries();
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch<{ account: Account }>("/api/accounts/me/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount, currency: "GBP" }),
      }),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

/** Pay by sort code + account number. Never send a source or destination account id. */
export function useTransfer() {
  const invalidate = useInvalidateBankingQueries();
  return useMutation({
    mutationFn: (input: {
      sortCode: string;
      accountNumber: string;
      amount: number;
    }) =>
      apiFetch<{
        account: Account;
        transfer: {
          id: string;
          amount: { amount: number; currency: "GBP" };
          destinationHolderName: string;
          destinationMaskedAccountNumber: string;
          rail: "puro" | "external";
        };
      }>("/api/transfers", {
        method: "POST",
        body: JSON.stringify({ ...input, currency: "GBP" }),
      }),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useAdminCustomers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: async () => {
      const data = await apiFetch<{ customers: AdminCustomer[] }>(
        "/api/admin/customers",
      );
      return data.customers;
    },
    enabled,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      apiFetch<{ customer: { id: string; accountNumber: string } }>(
        "/api/admin/customers",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string; email: string }) =>
      apiFetch<{ customer: { id: string; name: string; email: string } }>(
        `/api/admin/customers/${input.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: input.name, email: input.email }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useCloseCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/admin/customers/${id}/close`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useRevealCard() {
  return useMutation({
    mutationFn: (pin: string) =>
      apiFetch<{ cardNumber: string }>("/api/accounts/me/card", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }),
  });
}
