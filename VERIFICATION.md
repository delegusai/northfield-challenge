# Baseline verification

Checked locally on October 29, 2026, using Python 3.9.6 and the in-app browser.

`python3 -m unittest discover -s tests -v` passed all 18 tests. The generated-sequence test included 1,600 proposals across 20 independent sessions. After every proposal, the ledger remained within the total allowance, contained only approved suppliers, and had no duplicate request or supplier/invoice pair. Refusals left the ledger unchanged. A two-thread test showed that two simultaneous $15,000 requests could not both consume the same $25,000 allowance.

In the browser, an allowed $1,250 request produced one ledger entry. Repeating it was refused. A $30,000 request carrying a note claiming expanded authority was refused without adding an entry. Withdrawing authority then blocked a new otherwise valid request. The downloaded JSON contained exactly those four attempts and the single $1,250 ledger entry.

Starting a new session cleared the records and restored the fixture allowance. The allowed-payment flow also worked at a 390-pixel viewport. The page's content width equaled the viewport width, with no horizontal page overflow. Desktop and mobile layouts were visually inspected. No browser errors or warnings were reported during the checked flow.

These observations apply to this local scripted simulator. No language model was evaluated. No live product, real payment, production system, or public deployment was exercised. Records are unsigned and kept in process memory.
