# AI usage

I made use of Cursor AI for architecting and planning. How to split the frontend, the API and Postgres, what to build and what to leave out. It also helped in writing some of the content, which I then edited.

For mock data and seeding I used it to get a first draft of the demo bank, users and starting balances, so I could log in and try a transfer without writing all the seed SQL from scratch. After that I went through the seed myself. Names, roles, amounts, sort codes, account numbers.

On the UI I set up shadcn/ui + Tailwind. I used it to generate the primitives I actually needed: button, dialog, input, label, select, separator. Not the whole shadcn kit. The statement screens, money dialog and copy I built on top of those.

TypeScript types were a good use of it. It drafted `frontend/src/types/api.ts` and the request/response shapes so I was not writing every interface by hand. Money as `{ amount, currency }`, `Payee`, `User`, `Account`. I still went through those types. No source or destination account id on what the client sends. `any` was not allowed to leak into the money calls.

For the SQL I used it to draft some of the smaller queries: load the owned account by `user_id`, look up a payee by sort code and account number, `FOR UPDATE` on the account row. That saved me typing the same SELECT over and over. I still read every one before it stayed. Lock order, who the `WHERE` is on, and that the source account never comes from the client. Those I did not leave to generation.

It also helped me draft `backend/src/lib/errors.ts`. The named cases (`INSUFFICIENT_FUNDS`, `SAME_ACCOUNT_TRANSFER`, `ACCOUNT_NOT_FOUND`, and the rest), the `AppError` helper, and the `{ error: { code, message } }` shape so the UI can show a proper decline instead of a generic 500. I went through that list and kept what the API actually throws. Stack traces stay on the server.

On tests, AI drafted the file shape: `describe` / `it`, the Testing Library render, the mocks. I did not keep a pile of frontend tests. I kept two files.

`money.test.ts` is there so `"10.50"` stays `1050` and `parseFloat` cannot sneak back in. `MoneyDialog.test.tsx` is there so transfer is sort code + account number, PIN before the POST, and a decline does not look like success. The extra UI tests (copy, activity labels, api helper) I removed. They were not proving the brief.

I did not take the banking rules from generation at face value. A few times the output was wrong, or not what the brief asked for. These are the ones that mattered.

**1. Source account id on the client**

The first API draft let the client send a source account id on deposit, withdraw and transfer. Later, when the UI was being rebuilt, it tried to put a destination account id on the transfer body as well.

That is not “own account only”. If the id comes from the browser, anyone who can guess another id can touch that account.

I caught it by reading the handler and asking where the account comes from. If the answer is the JSON body, it is wrong. The server now loads the account from the session user. Transfer is sort code, account number and amount. No account ids from the client.

**2. parseFloat on money**

Amount parsing used `parseFloat` and then multiplied by 100. That is the usual generated banking snippet.

JavaScript floats are not safe for pence. `"10.50"` can come out as 1049.999 instead of 1050.

I caught it because the whole app is integer minor units, so I checked what `"10.50"` actually became. I replaced it with a regex and integer math (`parseMajorToMinor` / `parsePositiveMinorUnits`) and kept a test on that helper so it does not sneak back in.

**3. Delaying the payment request**

The money dialog waited on `setTimeout` and only then called deposit, withdraw or transfer, so the processing screen would look like a real bank.

The payment should not sit behind a timer. On localhost the request is instant anyway, and a decline should not wait for the animation.

I caught it by reading the dialog: Authorize did not fire the POST straight away. The request now starts immediately. The screen can stay up so you actually see processing. A decline skips that wait.

**4. Transfer as a list of other customers**

The first transfer UI was a dropdown of everyone at the bank. Pick Alex, send money.

That is not how you pay someone, and it is not what I wanted for this app. It also shows you other customers’ accounts.

I caught it when I used the flow. I would never pay like that. Transfer is sort code and account number now, with a preview before you confirm. If it is a Puro sort code we move money in-bank. Any other sort code is an outbound debit.
