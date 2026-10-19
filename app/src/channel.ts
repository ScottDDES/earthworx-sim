// Which build this is. Beta (TestFlight, the web version, local) gets the expansion packs free so testers can play
// them; the store build (VITE_CHANNEL=live) will sell them. Anything other than 'live' is beta.

export const BETA: boolean = (import.meta.env.VITE_CHANNEL as string | undefined) !== 'live';
