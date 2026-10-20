/**
 * The class diagrams the Build pages draw with ClassMap. Each export is the
 * full set of props for one diagram, so a page writes
 *
 *   import ClassMap from '@site/src/components/ClassMap';
 *   import {strategyFamily} from '@site/src/components/ClassMap/diagrams';
 *
 *   <ClassMap {...strategyFamily} />
 *
 * Coordinates are hand-placed. A card's height follows from its content (see
 * ClassMap), and every link's points are written against those heights.
 */

/* Build -> Stage Resolver: every class the registries pick is a strategy.
   Three columns, one per kind of strategy, each family hanging from a spine
   down its left edge. */
export const strategyFamily = {
  width: 700,
  height: 436,
  label:
    'Class diagram of the strategies. At the top is the Strategy interface, with a key and an appliesTo. Three interfaces are kinds of Strategy: PaymentVerifyStage, with run; Check, with steps and fetch; and ClearingMethod, with clear. DefaultPaymentVerifyStage implements PaymentVerifyStage, with the key VERIFY, in every market. MandateCheck and GBFundsCheck implement Check: MandateCheck has the key MANDATE and applies where mandate authorization is Y, and GBFundsCheck, which only GB has, has the key FUNDS and applies in GB with bank confirmation Y. Their keys differ, so both can run. RealtimeClearing and BatchClearing implement ClearingMethod with the same key, CLEARING, one for realtime clearing Y and one for N, so exactly one runs.',
  classes: [
    {id: 'strategy', kind: 'interface', name: 'Strategy<K>', x: 284, y: 12, w: 200, members: ['key: K', 'appliesTo: AppliesTo']},
    {id: 'stage', kind: 'interface', name: 'PaymentVerifyStage', x: 10, y: 158, w: 256, members: ['run(ctx, paymentId)']},
    {id: 'check', kind: 'interface', name: 'Check', x: 290, y: 158, w: 188, members: ['steps: Set<Step>', 'fetch(ctx, paymentId)']},
    {id: 'clearing', kind: 'interface', name: 'ClearingMethod', x: 502, y: 158, w: 188, members: ['clear(ctx, paymentId)']},
    {id: 'default', kind: 'class', name: 'DefaultPaymentVerifyStage', note: 'VERIFY · every market', x: 32, y: 284, w: 234},
    {id: 'mandate', kind: 'class', name: 'MandateCheck', note: 'MANDATE · mandate Y', x: 312, y: 284, w: 166},
    {id: 'funds', kind: 'class', name: 'GBFundsCheck', note: 'FUNDS · GB, bank Y', market: 'GB', x: 312, y: 348, w: 166},
    {id: 'realtime', kind: 'class', name: 'RealtimeClearing', note: 'CLEARING · realtime Y', x: 524, y: 284, w: 166},
    {id: 'batch', kind: 'class', name: 'BatchClearing', note: 'CLEARING · realtime N', x: 524, y: 348, w: 166},
  ],
  links: [
    // three interfaces gather into one trunk, straight up from Check
    {type: 'extends', points: [[138, 158], [138, 134], [384, 134]], head: false},
    {type: 'extends', points: [[596, 158], [596, 134], [384, 134]], head: false},
    {type: 'extends', points: [[384, 158], [384, 134]], head: false},
    {type: 'extends', points: [[384, 134], [384, 110]]},
    // each family hangs from a spine down its column
    {type: 'implements', points: [[32, 310], [21, 310], [21, 240]]},
    {type: 'implements', points: [[312, 310], [301, 310]], head: false},
    {type: 'implements', points: [[312, 374], [301, 374], [301, 256]]},
    {type: 'implements', points: [[524, 310], [513, 310]], head: false},
    {type: 'implements', points: [[524, 374], [513, 374], [513, 240]]},
  ],
  texts: [
    {x: 312, y: 424, text: 'Different keys: both run'},
    {x: 524, y: 424, text: 'One key: exactly one runs'},
  ],
};

/* Build -> Stage Resolver: the classes that do the picking, numbered in the
   order they act. StageResolver sits top left and reaches the rest through two
   lanes down its left side; the stage it binds sits under the registry it
   asks. */
export const pickingClasses = {
  width: 700,
  height: 342,
  label:
    'Class diagram of the classes that do the picking, numbered in the order they act. StageResolver has resolve(profile). It first makes a StageContext, which holds the resolved profile and the stubs. Second, it picks the stage from a Registry, which has forProfile and one. Third, it binds that stage, DefaultPaymentVerifyStage, to the context. The stage then asks a Registry for its checks, fourth, and asks the RuleRegistry, which has evaluate, for its rules, fifth.',
  classes: [
    {id: 'resolver', kind: 'class', name: 'StageResolver', x: 10, y: 12, w: 200, members: ['resolve(profile): Stages']},
    {id: 'ctx', kind: 'data', name: 'StageContext', x: 494, y: 12, w: 196, members: ['profile: ResolvedProfile', 'stubs: Stubs']},
    {id: 'registry', kind: 'class', name: 'Registry<S>', x: 250, y: 130, w: 210, members: ['forProfile(profile): List<S>', 'one(profile): S']},
    {id: 'rules', kind: 'class', name: 'RuleRegistry', x: 466, y: 130, w: 224, members: ['evaluate(profile, step, facts)']},
    {id: 'stage', kind: 'class', name: 'DefaultPaymentVerifyStage', x: 250, y: 262, w: 238, members: ['run(ctx, paymentId)']},
  ],
  links: [
    {type: 'makes', points: [[210, 45], [494, 45]], step: 1, label: 'makes the context', at: [224, 37]},
    {type: 'uses', points: [[70, 78], [70, 171], [250, 171]], step: 2, label: 'picks the stage', at: [84, 163]},
    {type: 'uses', points: [[40, 78], [40, 295], [250, 295]], step: 3, label: 'binds it to the context', at: [54, 287]},
    {type: 'uses', points: [[290, 262], [290, 212]], step: 4, label: 'asks for its checks', at: [300, 241]},
    {type: 'uses', points: [[488, 295], [556, 295], [556, 196]], step: 5, label: 'asks for its rules', at: [566, 241]},
  ],
};

/* Build -> Stages: the pieces of a verification rule. The rule's own chain
   runs down the left; the market's rule sets hang off RuleSet; a Rule's two
   specifications cross to the right, and ask about the facts above them. */
export const rulePieces = {
  width: 700,
  height: 436,
  label:
    'Class diagram of the verification rules. The RuleRegistry, with evaluate, holds every RuleSet bean. RuleSet is an interface with a list of rules; InstrumentRules, MandateRules and GBRules implement it, and GBRules is GB\'s own. A RuleSet holds Rules. A Rule has an id, an appliesTo, the steps it runs in, two specifications, runsWhen and passes, a decline code and a priority. It uses the Spec interface, which has isSatisfiedBy, and, or and not. A Spec asks about the VerificationFacts: each check\'s answer, the settings and the time.',
  classes: [
    {id: 'registry', kind: 'class', name: 'RuleRegistry', x: 10, y: 12, w: 226, members: ['evaluate(profile, step, facts)']},
    {id: 'set', kind: 'interface', name: 'RuleSet', x: 10, y: 128, w: 218, members: ['rules: List<Rule>']},
    {id: 'instrument', kind: 'class', name: 'InstrumentRules', x: 272, y: 105, w: 172},
    {id: 'mandate', kind: 'class', name: 'MandateRules', x: 272, y: 151, w: 172},
    {id: 'gb', kind: 'class', name: 'GBRules', market: 'GB', x: 272, y: 197, w: 172},
    {
      id: 'rule',
      kind: 'data',
      name: 'Rule',
      x: 10,
      y: 260,
      w: 218,
      members: ['id', 'appliesTo', 'steps', 'runsWhen: Spec', 'passes: Spec', 'declineCode', 'priority'],
    },
    {id: 'facts', kind: 'data', name: 'VerificationFacts', x: 514, y: 12, w: 176, members: ["each check's answer", 'settings', 'asOf']},
    {id: 'spec', kind: 'interface', name: 'Spec<T>', x: 514, y: 280, w: 176, members: ['isSatisfiedBy(t)', 'and(other)', 'or(other)', 'not()']},
  ],
  links: [
    {type: 'holds', points: [[119, 78], [119, 128]], label: 'every bean', at: [130, 107], align: 'start'},
    {type: 'implements', points: [[272, 123], [250, 123], [250, 169]], head: false},
    {type: 'implements', points: [[272, 215], [250, 215], [250, 169]], head: false},
    {type: 'implements', points: [[272, 169], [228, 169]]},
    {type: 'holds', points: [[119, 210], [119, 260]], label: 'its rules', at: [130, 239], align: 'start'},
    {type: 'uses', points: [[228, 345], [514, 345]], label: 'runsWhen, passes', at: [371, 337]},
    {type: 'uses', points: [[602, 280], [602, 110]], label: 'asks about', at: [612, 199], align: 'start'},
  ],
};

/* Build -> Domain Model: the type hierarchy. The root chain runs down the
   centre; what a payment holds hangs off its left; the two shapes sit to the
   right of the state classes, each with its data classes under it, and both
   kinds of data class gather back into the state class below. */
export const typeHierarchy = {
  width: 700,
  height: 552,
  label:
    "Class diagram of the payment type hierarchy. At the top, the Transaction interface, with an id, an account and an optional amount. Payment and Refund are kinds of Transaction; Refund has no concrete types yet. Payment holds a status, a source, a timeline, an option and an instrument. It holds three sealed types: PaymentOption and Instrument, each going from Reference to Verified, and Timeline, which is either an InitialTimeline or an ExecutableTimeline, immediate or scheduled. Fourteen sealed state classes, one per state from Pending to Disallowed, implement Payment. Two shape interfaces are kinds of Payment: FullPayment, and SplitPayment, which adds originalPaymentId and sequenceNumber. The data classes combine the two: fourteen {State}FullPayment classes implement FullPayment, eight {State}SplitPayment classes, the legs, implement SplitPayment, and every one of them is a kind of its state class.",
  classes: [
    {id: 'transaction', kind: 'interface', name: 'Transaction', x: 250, y: 12, w: 210, members: ['id: TransactionId', 'account', 'amount?']},
    {id: 'payment', kind: 'interface', name: 'Payment', x: 250, y: 160, w: 210, members: ['status, source, timeline', 'option, instrument']},
    {id: 'refund', kind: 'data', name: 'Refund', note: 'no concrete types yet', x: 490, y: 160, w: 200},
    {id: 'option', kind: 'interface', name: 'PaymentOption', x: 10, y: 12, w: 200, members: ['Reference → Verified']},
    {id: 'instrument', kind: 'interface', name: 'Instrument', x: 10, y: 108, w: 200, members: ['Reference → Verified']},
    {id: 'timeline', kind: 'interface', name: 'Timeline', x: 10, y: 204, w: 200, members: ['InitialTimeline', 'ExecutableTimeline', '↳ Immediate, Scheduled']},
    {
      id: 'state',
      kind: 'class',
      name: '{State}Payment',
      note: '14 sealed classes, one per state',
      x: 10,
      y: 340,
      w: 230,
      members: ['Pending · Scheduled', 'Accepted · Allocating', 'Allocated · Processing', 'Processed · Paid', 'Returned · Representing', 'Represented · Cancelled', 'Declined · Disallowed'],
    },
    {id: 'full', kind: 'interface', name: 'FullPayment', x: 280, y: 340, w: 190},
    {id: 'split', kind: 'interface', name: 'SplitPayment', x: 500, y: 340, w: 190, members: ['originalPaymentId', 'sequenceNumber']},
    {id: 'fullData', kind: 'data', name: '{State}FullPayment', note: '14 classes, one per state', x: 280, y: 470, w: 190},
    {id: 'splitData', kind: 'data', name: '{State}SplitPayment', note: '8 classes: the legs', x: 500, y: 470, w: 190},
  ],
  links: [
    // Payment and Refund gather into one trunk up to Transaction
    {type: 'extends', points: [[590, 160], [590, 143], [355, 143]], head: false},
    {type: 'extends', points: [[355, 160], [355, 143]], head: false},
    {type: 'extends', points: [[355, 143], [355, 126]]},
    // what a payment holds, down a spine on its left
    {type: 'holds', points: [[250, 200], [230, 200], [230, 53], [210, 53]]},
    {type: 'holds', points: [[230, 149], [210, 149]], head: false},
    {type: 'holds', points: [[230, 200], [230, 261], [210, 261]], head: false},
    // the state classes implement Payment
    {type: 'implements', points: [[226, 340], [226, 296], [300, 296], [300, 258]]},
    // the two shapes are kinds of Payment
    {type: 'extends', points: [[595, 340], [595, 312], [385, 312]], head: false},
    {type: 'extends', points: [[385, 340], [385, 312]], head: false},
    {type: 'extends', points: [[385, 312], [385, 258]]},
    // each data class implements its shape
    {type: 'implements', points: [[375, 470], [375, 392]]},
    {type: 'implements', points: [[595, 470], [595, 438]]},
    // and every data class is a kind of its state class
    {type: 'extends', points: [[375, 522], [375, 538]], head: false},
    {type: 'extends', points: [[595, 522], [595, 538], [125, 538]], head: false},
    {type: 'extends', points: [[125, 538], [125, 518]]},
  ],
};
