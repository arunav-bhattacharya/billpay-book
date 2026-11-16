/**
 * What starts or resumes a payment from outside its running work.
 *
 * The word is the mechanism, so an engineer can tell an update (which gets an
 * answer back) from a signal (which doesn't), and both from a new run that a
 * dispatcher, a callback or a pair of events starts. Every place that marks a
 * trigger reads this one table, and draws it in the one trigger pink,
 * --amex-trigger: JourneyMap's flags, TriggerTag, and through TriggerTag the
 * call lists and the routing ledger.
 */
export const TRIGGER_KIND = {
  update: {word: 'Update', note: 'a Temporal update to the running workflow, which answers its sender'},
  signal: {word: 'Signal', note: 'a Temporal signal to the running workflow, with no answer back'},
  callback: {word: 'Callback', note: 'a partner system calls Billpay back, which starts this step'},
  dispatcher: {word: 'Dispatcher', note: 'a dispatcher picks up a due row and starts this step'},
  events: {word: 'Events', note: "events from other systems, paired in One-Data's inbox, start this step"},
};

export function triggerKind(kind) {
  return TRIGGER_KIND[kind] || TRIGGER_KIND.events;
}

/* The arrow into a bar: something arriving from outside. Drawn on a 24 unit
   grid, stroked in the surrounding ink. */
export const TRIGGER_ICON = ['M12 3.6v10.6', 'M7 9.4l5 5 5-5', 'M5 19.6h14'];
