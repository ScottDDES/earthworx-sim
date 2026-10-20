// Starting a career: company name, the start-up loan (which sets the difficulty), Hardcore, then the town.

import { useState } from 'react';
import { BETA } from '../channel';
import { SlotsCard, type Saves } from '../Slots';
import { SeasonPicker } from '../Seasons';
import { slotMetaAll } from '../store';
import { TOWNS, weeklyRepay, type game, type TownId } from '@engine';
import { MachineIcon } from '../Icon';
import { f, fk } from '../format';

const LOANS = [
  { a: 80000, n: 'Shoestring', d: 'HARD', chip: 'c-bad', b: 'An old grader. You fix it yourself. Most players are ready to subcontract around week 70. GST and the BAS are yours to manage.' },
  { a: 180000, n: 'Solid start', d: 'NORMAL', chip: 'c-idle', b: 'A decent used grader. Hire it out and drive it yourself. Ready to subcontract around week 45. A bookkeeper looks after the GST.' },
  { a: 350000, n: 'Go big', d: 'EASY', chip: 'c-job', b: 'Grader and roller both earning. Ready to subcontract within about 10 weeks, if the repayments don\'t bite. No tax paperwork.' },
];

export function SetupScreen({ onStart, saves }: { onStart: (s: game.Setup) => void; saves: Saves }) {
  const [step, setStep] = useState(0);
  const [co, setCo] = useState('Black Soil Earthmoving');
  const [loan, setLoan] = useState(180000);
  const [hc, setHc] = useState(false);
  const [bulk, setBulk] = useState(BETA);
  const [path, setPath] = useState<'roads' | 'bulk'>('roads');
  const [town, setTown] = useState<TownId>('gdi');

  if (step === 0) {
    return (
      <div className="wrap setup">
        <div className="hero">
          <div className="row">
            <span className="tiny grow" style={{ color: 'var(--head-muted)' }}>Earthworx Sim</span>
            <span style={{ color: '#FFC700' }}><MachineIcon type="grader" /></span>
          </div>
          <h1>Start your own earthmoving company</h1>
          <p>Floods have torn up the gravel roads and there's work for anyone with a machine. Start with one and build from there.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="co" className="sub">Company name</label>
          <input id="co" className="field" value={co} onChange={(e) => setCo(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row"><span className="sub grow">Start-up loan</span></div>
          <div className="small muted">The loan sets the difficulty. A small loan means cheap repayments but a slow, hard start.</div>
          {LOANS.map((l) => (
            <button key={l.a} type="button" className={'pick' + (loan === l.a ? ' on' : '')} onClick={() => setLoan(l.a)}>
              <span className="row" style={{ width: '100%' }}>
                <b className="grow" style={{ fontSize: 16 }}>{l.n} <span className={'chip ' + l.chip} style={{ marginLeft: 6, verticalAlign: 2 }}>{l.d}</span></b>
                <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{fk(l.a)}</span>
              </span>
              <span className="small"><b>You start with {fk(l.a + 40000)}</b>: this loan plus $40k of your own savings.</span>
              <span className="small muted">{l.b}</span>
              <span className="small" style={{ color: 'var(--rust)', fontWeight: 600 }}>Repayments {f(weeklyRepay(l.a))} a week, working or not</span>
            </button>
          ))}
        </div>
        <button type="button" className={'pick' + (hc ? ' on' : '')} aria-pressed={hc} onClick={() => setHc(!hc)}>
          <span className="row" style={{ width: '100%' }}>
            <b className="grow" style={{ fontSize: 16 }}>Hardcore{hc && <span className="chip c-bad" style={{ marginLeft: 6, verticalAlign: 2 }}>ON</span>}</b>
            <span className="small muted">{hc ? 'Tap to turn off' : 'Off'}</span>
          </span>
          <span className="small muted">One life. If what you own is worth less than what you owe for four weeks running, the business goes into administration and the career is over. The tax office gives one payment plan a year, no more.</span>
        </button>
        <div className="small note">{hc ? 'Hardcore: no second chances. You\'ll get a warning the first week you\'re under water.' : 'Miss three repayments and the bank takes your best machine. You keep going with what\'s left.'}</div>
        {BETA && (
          <>
            <div className="row"><span className="sub grow">What kind of outfit?</span></div>
            <button type="button" className={'pick' + (path === 'roads' ? ' on' : '')} aria-pressed={path === 'roads'} onClick={() => setPath('roads')}>
              <b style={{ fontSize: 16 }}>Roads</b>
              <span className="small muted">Start with a grader. Hire work, council day labour and private jobs, then flood recovery subcontracts and council contracts.</span>
            </button>
            <button type="button" className={'pick' + (path === 'bulk' ? ' on' : '')} aria-pressed={path === 'bulk'} onClick={() => setPath('bulk')}>
              <b style={{ fontSize: 16 }}>Bulk earthworks</b>
              <span className="tiny" style={{ color: 'var(--teal)', fontWeight: 700 }}>Bulk and Ag pack · free in the beta</span>
              <span className="small muted">Start with a dozer or an excavator. Farm dams, channels, contour banks, clearing and laser levelling, then developers' bulk earthworks.</span>
            </button>
            {path === 'roads' && (
              <button type="button" className={'pick' + (bulk ? ' on' : '')} aria-pressed={bulk} onClick={() => setBulk(!bulk)}>
                <span className="row" style={{ width: '100%' }}>
                  <b className="grow" style={{ fontSize: 16 }}>Add bulk work later{bulk && <span className="chip c-job" style={{ marginLeft: 6, verticalAlign: 2 }}>ON</span>}</b>
                  <span className="small muted">{bulk ? 'Tap to turn off' : 'Off'}</span>
                </span>
                <span className="small muted">Dozers and scrapers in the Market and farmers ringing on the Work tab, alongside your road work.</span>
              </button>
            )}
          </>
        )}
        <button type="button" className="big" onClick={() => setStep(1)}>Next: pick your base</button>
        {Object.keys(slotMetaAll()).length > 0 && <SlotsCard saves={saves} />}
        <SeasonPicker saves={saves} />
      </div>
    );
  }

  return (
    <div className="wrap setup">
      <div className="hero">
        <h1>Where's your yard?</h1>
        <p>Queensland for now: the two towns where we have 30 years of real rainfall. Your town sets the weather.</p>
      </div>
      {(Object.keys(TOWNS) as TownId[]).map((k) => (
        <button key={k} type="button" className={'pick' + (town === k ? ' on' : '')} onClick={() => setTown(k)}>
          <b style={{ fontSize: 17 }}>{TOWNS[k].name}</b>
          <span className="small muted">{TOWNS[k].blurb}</span>
        </button>
      ))}
      <div className="btns"><button type="button" className="btn" onClick={() => setStep(0)}>Back</button></div>
      <div className="small muted" style={{ textAlign: 'center' }}>{fk(loan)} loan + $40k savings = {fk(loan + 40000)} in the bank to buy your first machine.</div>
      <button type="button" className="big" onClick={() => onStart({ co, loan, town, hc, bulk: BETA && bulk, path: BETA ? path : 'roads' })}>Take the {fk(loan)} loan and set up in {TOWNS[town].name}</button>
    </div>
  );
}
