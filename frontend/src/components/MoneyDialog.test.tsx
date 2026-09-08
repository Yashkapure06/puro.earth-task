import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoneyDialog } from "./MoneyDialog";
import { ApiRequestError } from "@/lib/api";
import { DEMO_AUTHORIZE_PIN } from "@/lib/authorize-pin";

const depositMutate = vi.fn();
const withdrawMutate = vi.fn();
const transferMutate = vi.fn();
const lookupMutate = vi.fn();

vi.mock("@/lib/processing", () => ({
  MONEY_PROCESSING_MIN_MS: 0,
  waitWithFloor: <T,>(task: Promise<T>) => task,
}));

vi.mock("@/hooks/useBanking", () => ({
  useDeposit: () => ({
    mutateAsync: depositMutate,
    isPending: false,
    reset: vi.fn(),
  }),
  useWithdraw: () => ({
    mutateAsync: withdrawMutate,
    isPending: false,
    reset: vi.fn(),
  }),
  useTransfer: () => ({
    mutateAsync: transferMutate,
    isPending: false,
    reset: vi.fn(),
  }),
  useLookupPayee: () => ({
    mutateAsync: lookupMutate,
    isPending: false,
    reset: vi.fn(),
  }),
}));

function renderDialog(mode: "deposit" | "withdraw" | "transfer") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MoneyDialog open mode={mode} onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

async function fillTransferPayee(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText("Sort code"), "040011");
  await user.type(screen.getByLabelText("Account number"), "31975512");
}

describe("MoneyDialog", () => {
  beforeEach(() => {
    depositMutate.mockReset();
    withdrawMutate.mockReset();
    transferMutate.mockReset();
    lookupMutate.mockReset();
    lookupMutate.mockResolvedValue({
      rail: "puro",
      name: "Alex Morgan",
      sortCode: "04-00-11",
      accountNumber: "31975512",
    });
  });

  it("does not submit an invalid deposit amount", async () => {
    const user = userEvent.setup();
    renderDialog("deposit");
    await user.type(screen.getByLabelText("Amount"), "abc");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(depositMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid amount");
  });

  it("does not pay until the demo PIN is authorized", async () => {
    depositMutate.mockResolvedValue({});
    const user = userEvent.setup();
    renderDialog("deposit");
    await user.type(screen.getByLabelText("Amount"), "10.50");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(depositMutate).not.toHaveBeenCalled();
    const pin = screen.getByLabelText("PIN");
    expect(pin).toHaveAttribute("type", "password");
    await user.type(pin, "0000");
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    expect(depositMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect PIN");
  });

  it("submits deposit in minor units after a valid PIN", async () => {
    depositMutate.mockResolvedValue({});
    const user = userEvent.setup();
    renderDialog("deposit");
    await user.type(screen.getByLabelText("Amount"), "10.50");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByLabelText("PIN"), DEMO_AUTHORIZE_PIN);
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    expect(depositMutate).toHaveBeenCalledWith(1050);
    expect(
      await screen.findByRole("heading", { name: "Deposit posted" }),
    ).toBeInTheDocument();
    expect(screen.getByText("£10.50")).toBeInTheDocument();
    expect(screen.getByText("Added to your available balance.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("shows processing until the payment is posted", async () => {
    let finish: (value: unknown) => void = () => {};
    depositMutate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    renderDialog("deposit");
    await user.type(screen.getByLabelText("Amount"), "10.50");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByLabelText("PIN"), DEMO_AUTHORIZE_PIN);
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    expect(
      await screen.findByRole("heading", { name: "Adding funds" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Depositing £10.50");
    expect(screen.getByRole("progressbar", { name: "Posting payment" })).toBeInTheDocument();
    expect(screen.getByText("Posting the deposit")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Done" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      finish({});
    });
    expect(
      await screen.findByRole("heading", { name: "Deposit posted" }),
    ).toBeInTheDocument();
  });

  it("keeps the dialog open when the API declines", async () => {
    depositMutate.mockRejectedValue(
      new ApiRequestError(409, {
        error: { code: "INSUFFICIENT_FUNDS", message: "Not enough" },
      }),
    );
    const user = userEvent.setup();
    renderDialog("deposit");
    await user.type(screen.getByLabelText("Amount"), "10.50");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByLabelText("PIN"), DEMO_AUTHORIZE_PIN);
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Declined. Not enough available funds");
    expect(screen.getByRole("button", { name: "Authorize" })).toBeInTheDocument();
  });

  it("does not submit an invalid transfer amount", async () => {
    const user = userEvent.setup();
    renderDialog("transfer");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(lookupMutate).not.toHaveBeenCalled();
    expect(transferMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid amount");
  });

  it("looks up the payee from sort code and account number", async () => {
    const user = userEvent.setup();
    renderDialog("transfer");
    await fillTransferPayee(user);
    await user.type(screen.getByLabelText("Amount"), "10.50");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(lookupMutate).toHaveBeenCalledWith({
      sortCode: "040011",
      accountNumber: "31975512",
    });
    expect(transferMutate).not.toHaveBeenCalled();
    expect(await screen.findByText("£10.50 to Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("04-00-11 / 31975512")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("reviews an outbound payment to another bank", async () => {
    lookupMutate.mockResolvedValue({
      rail: "external",
      name: "another bank",
      sortCode: "11-11-11",
      accountNumber: "11111111",
    });
    const user = userEvent.setup();
    renderDialog("transfer");
    await user.type(screen.getByLabelText("Sort code"), "111111");
    await user.type(screen.getByLabelText("Account number"), "11111111");
    await user.type(screen.getByLabelText("Amount"), "111");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("£111.00 to another bank")).toBeInTheDocument();
    expect(screen.getByText("11-11-11 / 11111111")).toBeInTheDocument();
    expect(
      screen.getByText("This payment leaves Puro. Check the details, then authorize."),
    ).toBeInTheDocument();
  });
});
