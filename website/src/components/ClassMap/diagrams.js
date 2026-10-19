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

/* Build -> Stage Index: every class the registries pick is a strategy.
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

/* Build -> Stage Index: the classes that do the picking, numbered in the
   order they act. StageIndex sits top left and reaches the rest through two
   lanes down its left side; the stage it binds sits under the registry it
   asks. */
export const pickingClasses = {
  width: 700,
  height: 342,
  label:
    'Class diagram of the classes that do the picking, numbered in the order they act. StageIndex has lookup(plan). It first makes a StageContext, which holds the plan key and the stubs. Second, it picks the stage from a Registry, which has forPlan and one. Third, it binds that stage, DefaultPaymentVerifyStage, to the context. The stage then asks a Registry for its checks, fourth, and asks the RuleRegistry, which has evaluate, for its rules, fifth.',
  classes: [
    {id: 'index', kind: 'class', name: 'StageIndex', x: 10, y: 12, w: 172, members: ['lookup(plan): Stages']},
    {id: 'ctx', kind: 'data', name: 'StageContext', x: 514, y: 12, w: 176, members: ['plan: PlanKey', 'stubs: Stubs']},
    {id: 'registry', kind: 'class', name: 'Registry<S>', x: 250, y: 130, w: 186, members: ['forPlan(plan): List<S>', 'one(plan): S']},
    {id: 'rules', kind: 'class', name: 'RuleRegistry', x: 472, y: 130, w: 218, members: ['evaluate(plan, step, facts)']},
    {id: 'stage', kind: 'class', name: 'DefaultPaymentVerifyStage', x: 250, y: 262, w: 238, members: ['run(ctx, paymentId)']},
  ],
  links: [
    {type: 'makes', points: [[182, 45], [514, 45]], step: 1, label: 'makes the context', at: [196, 37]},
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
    {id: 'registry', kind: 'class', name: 'RuleRegistry', x: 10, y: 12, w: 218, members: ['evaluate(plan, step, facts)']},
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
