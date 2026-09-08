export type Currency = "GBP";

export type Money = {
  amount: number;
  currency: Currency;
};

export type UserRole = "admin" | "customer";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type Account = {
  id: string;
  userId: string;
  currency: Currency;
  balance: Money;
  accountNumber: string;
  sortCode: string;
  maskedAccountNumber: string;
  maskedCardNumber: string;
  holderName: string;
  closed: boolean;
  updatedAt: string;
};

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: Money;
  signedAmount: Money;
  counterpartyName: string | null;
  counterpartyMaskedAccountNumber: string | null;
  createdAt: string;
};

export type Payee = {
  rail: "puro" | "external";
  name: string;
  sortCode: string;
  accountNumber: string;
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  accountNumber: string;
  sortCode: string;
  status: "open" | "closed";
  createdAt: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
