// Words for the cards: a tag, a title, and each option's label and note, by the option's id (choose.ts).
// From the prototype's wording. Names and amounts on a card are filled in by the screen from the career.

export interface CardText {
  tag: string;
  title: string;
  options: Record<string, { label: string; sub?: string }>;
}

export const CARD_TEXT: Record<string, CardText> = {
  swms: { tag: 'Safety', title: 'Head contractors want your SWMS', options: {
    pay: { label: 'Pay someone to write them · $2,500', sub: 'Done properly this week. You can tender straight away.' },
    self: { label: 'Write them yourself at night', sub: 'Free, but you\'re off the tools for a week while you finish them.' } } },
  serious: { tag: 'Serious incident', title: 'Someone is in hospital', options: {
    notify: { label: 'Notify the regulator and cooperate', sub: 'The site stands down for a week. Insurance up 25%, track record −2.' },
    hide: { label: 'Keep it quiet and get the job going', sub: 'If it comes out, it\'s a much bigger fine and the council won\'t touch you for six months.' } } },
  nearmiss: { tag: 'Near miss', title: 'That was close', options: {
    report: { label: 'Report it and talk it through', sub: 'Stop the crew for an hour, change the SWMS, log it.' },
    shrug: { label: 'Have a word and move on', sub: 'No time lost. The hazard\'s still there.' } } },
  quiet: { tag: 'Crew', title: 'Someone\'s been quiet lately', options: {
    yarn: { label: 'Take them for a feed and a yarn · $80', sub: 'An hour of your time. Just ask how they\'re going, and listen.' },
    daysOff: { label: 'Give them a few days off, paid', sub: 'Their seat goes to a casual this week.' },
    leave: { label: 'Leave it, they\'ll be right', sub: 'None of your business. Probably.' } } },
  turnover: { tag: 'Workshop', title: 'Time to turn this one over', options: {
    auction: { label: 'Put it in next week\'s auction', sub: 'Goes to the highest bidder.' },
    list: { label: 'List it privately', sub: 'Takes 2 to 5 weeks to sell.' },
    keep: { label: 'Keep it going another six months', sub: 'They won\'t raise it again until then.' } } },
  svcfind: { tag: 'Workshop', title: 'The service turned up a problem', options: {
    fix: { label: 'Fix it properly now', sub: 'Then it\'s sorted.' },
    patch: { label: 'Bandaid it', sub: 'Keeps working, but it\'s more likely to let go, and dearer when it does.' } } },
  swapin: { tag: 'Your fleet', title: 'Your machine is back in the yard', options: {
    putOn: { label: 'Put it on the contract', sub: 'The hire-in goes back.' },
    keepFree: { label: 'Keep it free for hire work', sub: 'The hire-in stays on. Not asked again for 4 weeks.' } } },
  rainday: { tag: 'Weather', title: 'Rain on the forecast', options: {
    standDown: { label: 'Stand the crews down', sub: 'Lose the day whatever falls. No rework.' },
    pushOn: { label: 'Push on and work through it', sub: 'If it misses you, you get the day in. Heavy rain means rework and the day\'s lost anyway.' } } },
  break: { tag: 'Breakdown', title: 'A machine has broken down', options: {
    warranty: { label: 'Claim it on the dealer warranty', sub: 'Free. Down a few days while their mechanic gets out.' },
    mobile: { label: 'Get a mobile mechanic out', sub: 'A quarter dearer. Back working next week.' },
    dealer: { label: 'Wait for the dealer\'s workshop', sub: 'Down a few days next week.' },
    hireIn: { label: 'Hire in a replacement', sub: 'The client never misses a day.' } } },
  brtender: { tag: 'Your branch', title: 'The branch has a council package', options: {
    sharp: { label: 'Go in sharp', sub: 'Good odds of winning, thin margin.' },
    proper: { label: 'Price it properly', sub: 'Less likely, but it pays.' },
    letGo: { label: 'Let it go', sub: 'Keep the crews on their usual work.' } } },
  brraise: { tag: 'Your branch', title: 'The branch manager wants a raise', options: {
    pay: { label: 'Pay it · +$400/wk', sub: 'Keeps them, and they might step up.' },
    no: { label: 'Say no', sub: 'Saves the money. They might walk.' } } },
  collapse: { tag: 'The industry', title: 'A head contractor has gone into administration', options: {
    claim: { label: 'Lodge a claim with the administrators', sub: 'Free. Wait and see what the dividend is.' },
    sell: { label: 'Sell the debt to a collector', sub: 'Cash this week, and you never think about it again.' } } },
  freeze: { tag: 'The industry', title: 'Flood recovery funding is on hold', options: {
    ok: { label: 'Batten down', sub: 'Keep the gear working on hire, chase what you\'re owed, and hold off buying.' } } },
  insure: { tag: 'The industry', title: 'Insurance has gone up across the board', options: {
    wear: { label: 'Wear it', sub: 'Pay the new rate for the year.' },
    broker: { label: 'Get a broker to shop it around · $1,500', sub: 'Half the time a broker finds cover that only goes up 15%.' } } },
  bankcall: { tag: 'The bank', title: 'The bank manager is on the phone', options: {
    moreTime: { label: 'Ask for more time · $750 fee', sub: 'Once. Don\'t make them ring again.' },
    ringAround: { label: 'Ring around about selling gear', sub: 'A bigger outfit may pay cash for machines this week.' },
    leave: { label: 'Leave it with them', sub: 'Next time it\'s a machine.' } } },
  bas: { tag: 'Tax office', title: 'Your BAS is due', options: {
    pay: { label: 'Lodge and pay', sub: 'On time and square with the tax office.' },
    payAnyway: { label: 'Pay it anyway', sub: 'No more payment plans this year. Track record −2.' },
    plan: { label: 'Ask for a payment plan', sub: 'Three payments over 12 weeks, with interest.' } } },
  yearend: { tag: 'Year in review', title: 'The year in review', options: {
    ok: { label: 'On to the new financial year', sub: 'It\'s all in the Office under Past years.' } } },
  late: { tag: 'Money', title: 'A client hasn\'t paid', options: {
    chase: { label: 'Chase it under Security of Payment', sub: 'Paid in 3 weeks, but they won\'t hire you for six months.' },
    friendly: { label: 'Ring the boss, keep it friendly', sub: 'Maybe half now. The relationship stays.' },
    park: { label: 'Park your machine until they pay', sub: 'They need it. Paid in full, but the hire\'s over.' },
    wait: { label: 'Wait it out', sub: 'Usually turns up within a fortnight.' } } },
  clearing: { tag: 'Opportunity', title: 'A roller at a clearing sale, Saturday', options: {
    borrow: { label: 'Borrow $20k and go bid', sub: 'Higher repayments, but you can take on pads and private jobs yourself.' },
    cash: { label: 'Go with cash only', sub: 'If it goes past $46k, you walk away.' },
    skip: { label: 'Skip it, keep building cash', sub: 'Safe. You\'ll keep hiring rollers in.' } } },
  hurt: { tag: 'Crew', title: 'Someone\'s back has gone', options: {
    home: { label: 'Send them home to get it checked', sub: 'Their job stops for 2 weeks.' },
    cover: { label: 'Jump on the machine yourself', sub: 'Their job keeps going. Yours stops for a week.' },
    keepGoing: { label: 'Let them keep going', sub: 'No lost time. A real risk of an injury.' } } },
  breakin: { tag: 'Bad luck', title: 'Someone\'s been in the yard', options: {
    claim: { label: 'Claim it on insurance', sub: '$1,000 excess. Your premium goes up 8% for a while.' },
    camera: { label: 'Replace it yourself and put up a camera', sub: '$3,800 now. Halves the chance of it happening again.' },
    without: { label: 'Run without GPS for now', sub: 'Grade by eye. Saves money today, if nobody notices.' } } },
  extra: { tag: 'Client', title: 'The client wants a bit extra', options: {
    ask: { label: 'Do it, then ask to be paid', sub: 'Keeps them happy. You might not get paid for it.' },
    agree: { label: 'Agree a price first', sub: 'A day lost sorting it out, but you\'ll get paid.' },
    free: { label: 'Do it free to keep them sweet', sub: 'They\'ll talk you up around town.' } } },
  callout: { tag: 'Opportunity', title: 'A storm\'s cut a road', options: {
    go: { label: 'Get out there', sub: '3 days at $2,100 a day, paid in 14 days. The council remembers who turned up.' },
    pullOff: { label: 'Pull your grader off its job', sub: 'Earn $6,300 and +1 track record. Your current job runs 3 days longer.' },
    flatOut: { label: 'Tell them you\'re flat out', sub: 'Nothing gained, nothing lost.' } } },
  early: { tag: 'Money', title: 'A client offers to pay early', options: {
    take: { label: 'Take it now, 3% off', sub: 'Cash in the bank today.' },
    wait: { label: 'Wait for the full amount', sub: 'Paid in full on their terms.' } } },
  tresult: { tag: 'Tender result', title: 'Tender result', options: {
    sign: { label: 'Sign the contract', sub: 'Starts when your grader, roller and water cart are free.' },
    pullOut: { label: 'Pull out', sub: 'Track record −2, and they won\'t ask you to price for six months.' },
    ok: { label: 'Carry on', sub: 'There\'ll be more packages.' } } },
  cresult: { tag: 'Tender result', title: 'Council tender result', options: {
    sign: { label: 'Sign the contract', sub: 'Crews mobilise as soon as you\'re free.' },
    pullOut: { label: 'Pull out', sub: 'Track record −3. Councils talk to each other.' },
    ok: { label: 'Carry on', sub: 'More packages come out most months.' } } },
  variation: { tag: 'Contract', title: 'The supervisor wants extra culverts', options: {
    lodge: { label: 'Do it, then lodge a variation', sub: 'Keeps the job moving. You\'ll need your site diary.' },
    writing: { label: 'Get it in writing first', sub: 'A day lost to paperwork, then you\'re covered.' },
    free: { label: 'Do it free to keep them sweet', sub: 'Two unpaid days. They\'ll remember it.' } } },
  gravel: { tag: 'Contract', title: 'The gravel failed its test', options: {
    cart: { label: 'Cart from the better pit further out', sub: 'More cartage for the rest of the job. A sure thing.' },
    work: { label: 'Work it harder: more water, more passes', sub: '2 more crew-days, unpaid. It might not pass.' },
    argue: { label: 'Argue it\'s within spec', sub: 'Costs nothing if you\'re right.' } } },
  drydam: { tag: 'Contract', title: 'The dam\'s down to mud', options: {
    bore: { label: 'Pay a landholder for bore water · $4,000', sub: 'Same distance. Crews keep going.' },
    far: { label: 'Cart from the next dam', sub: 'No cost now. Crews slow down.' },
    farMore: { label: 'Cart from the next dam and hire another cart per crew', sub: 'Crews keep their pace, for more a week.' } } },
  pitout: { tag: 'Contract', title: 'The near pit\'s run out', options: {
    far: { label: 'Switch to the far pit', sub: 'Same trucks, longer haul.' },
    farTrucks: { label: 'Switch and add two trucks per crew', sub: 'Keeps gravel up, for more per crew-day.' },
    farmer: { label: 'Buy from a farmer\'s pit next door', sub: 'Same short haul, $8 a m³ more.' } } },
  repo: { tag: 'The bank', title: 'The bank is taking a machine', options: {
    handOver: { label: 'Hand over the keys', sub: 'It\'s sold for about 60% of its value, which comes off your loan.' } } },
  buyout: { tag: 'Opportunity', title: 'A rival wants out', options: {
    whole: { label: 'Buy the whole outfit', sub: 'Their gear, some of their operators, and their track record.' },
    best: { label: 'Just buy their best gear', sub: 'Dearer per machine, but no crew or yard to absorb.' },
    letGo: { label: 'Let them go', sub: 'Their gear will probably turn up in a clearance sale.' } } },
  sellup: { tag: 'Opportunity', title: 'A bigger outfit has heard you\'re struggling', options: {
    two: { label: 'Sell them two machines', sub: 'Cash this week, no auction gamble.' },
    all: { label: 'Sell them the whole business', sub: 'This career ends.' },
    hold: { label: 'Hold on and trade out of it', sub: 'They might ring again if it gets worse.' } } },
};
