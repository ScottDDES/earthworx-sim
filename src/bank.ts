// The bank: the business loan and the overdraft.
// The loan is 9.5% over 5 years, repaid weekly. The overdraft costs 12% a year on what's drawn.
// Miss three repayments and the bank takes a machine.

export const LOAN_RATE = 0.095;
export const LOAN_MONTHS = 60;
export const OD_RATE = 0.12;
/** Missed repayments before the bank takes a machine. */
export const REPO_AT = 3;

export interface Loan {
  bal: number;
  weekly: number;
  missed: number;
  arrears: number;
  paidOff?: boolean;
}

/** The weekly repayment on a loan of this size: the monthly figure, spread over the weeks. */
export function weeklyRepay(amount: number): number {
  const rm = LOAN_RATE / 12;
  const monthly = (amount * rm) / (1 - Math.pow(1 + rm, -LOAN_MONTHS));
  return Math.round((monthly * 12) / 52);
}

export function newLoan(amount: number): Loan {
  return { bal: amount, weekly: weeklyRepay(amount), missed: 0, arrears: 0 };
}

/** Borrow more on the same loan. The repayment is worked out again on the new balance. */
export function topUp(loan: Loan, amount: number): void {
  loan.bal += amount;
  loan.weekly = weeklyRepay(loan.bal);
  loan.paidOff = false;
}

export interface BankWeek {
  /** Overdraft interest charged. */
  odInterest: number;
  /** Everything that left the account. */
  paid: number;
  /** Of what went to the loan, how much was interest (the rest came off the balance). */
  loanInterest: number;
  caughtUp: number;
  missedNow: boolean;
  /** The bank wants a word (two missed) or is taking a machine (three). */
  call: 'none' | 'warning' | 'repo';
}

/**
 * End of the week at the bank. Changes the balance and the loan in place.
 * odLimit is how far into the overdraft the bank lets you go, which grows as you climb the ladder.
 */
export function bankWeek(acct: { bank: number; loan: Loan }, odLimit: number): BankWeek {
  const out: BankWeek = { odInterest: 0, paid: 0, loanInterest: 0, caughtUp: 0, missedNow: false, call: 'none' };

  if (acct.bank < 0) {
    out.odInterest = Math.round((-acct.bank * OD_RATE) / 52);
    acct.bank -= out.odInterest;
    out.paid += out.odInterest;
  }

  const L = acct.loan;
  if (L.bal <= 0) return out;

  // Catch up missed repayments first, if there's room for them and this week's.
  if (L.arrears > 0 && acct.bank - L.arrears - L.weekly >= -odLimit) {
    acct.bank -= L.arrears;
    L.bal -= L.arrears * 0.7; // roughly 30% of missed repayments was interest
    out.paid += L.arrears;
    out.loanInterest += L.arrears * 0.3;
    out.caughtUp = L.arrears;
    L.arrears = 0;
    L.missed = 0;
  }

  if (acct.bank - L.weekly >= -odLimit) {
    const interest = (L.bal * LOAN_RATE) / 52;
    out.loanInterest += Math.min(L.weekly, interest);
    acct.bank -= L.weekly;
    out.paid += L.weekly;
    L.bal = Math.max(0, L.bal - (L.weekly - interest));
  } else {
    L.missed++;
    L.arrears += L.weekly;
    out.missedNow = true;
  }

  out.call = L.missed >= REPO_AT ? 'repo' : L.missed === 2 ? 'warning' : 'none';
  return out;
}
