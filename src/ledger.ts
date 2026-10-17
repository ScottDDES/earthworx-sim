// The books. Every dollar that moves goes through here, tagged with what it was for,
// so the profit and loss, the cash forecast and the year in review all read the same numbers.
// (Prototype names in brackets, for checking one against the other.)

export type Category =
  | 'jobCosts'       // fuel, wear, hire-ins and labour on a job, paid now (jc)
  | 'jobCostsOwed'   // job costs on account, paid later (jco)
  | 'workshop'       // services and repairs (ws)
  | 'capital'        // buying and selling gear and yards; a sale books as a minus (cap)
  | 'loan'           // money borrowed; a minus is new borrowing (loan)
  | 'collections'    // money in during the week that didn't come through an invoice (coll)
  | 'machineDays'    // a count, not dollars: days of machine work (md)
  | 'breakdowns'     // a count, not dollars (brk)
  | 'badDebts'       // invoices that were never paid (bd)
  | 'branch'         // the branch depot (br)
  | 'gst';           // (gst)

export type Accounts = Record<Category, number> & { openingBank: number };

export function newAccounts(openingBank: number): Accounts {
  return {
    openingBank,
    jobCosts: 0, jobCostsOwed: 0, workshop: 0, capital: 0, loan: 0,
    collections: 0, machineDays: 0, breakdowns: 0, badDebts: 0, branch: 0, gst: 0,
  };
}

/** Records an amount against a category. It doesn't move the bank balance: the caller does that. */
export function book(acc: Accounts, cat: Category, amt: number): void {
  acc[cat] += amt;
}

/** Pays money out of the bank and books it in one step, so the two can't drift apart. */
export function spend(acct: { bank: number; acc: Accounts }, cat: Category, amt: number): void {
  acct.bank -= amt;
  acct.acc[cat] += amt;
}
