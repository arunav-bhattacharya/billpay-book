# Editing the diagrams

The words in the site's diagrams live in the plain-text files in this folder, one file per diagram. You can change a step's name, a state, an event or a note without knowing any React, and the diagram redraws itself.

For now this covers the 20 journeys on **Design > Journeys > All Journeys**, in `journeys/`. Other diagrams will move here the same way.

## Change a journey in the Diagram Studio

The easiest way. Nothing to install.

1. Open the journey on the site and click **Edit this diagram** at its top right. The Diagram Studio opens on that journey. You can also open it at `/studio` and pick a journey from the list.
2. Click any part of the diagram to change it: the name, a step, the state, the calls, an end, a note. Hover between two steps to add one, drag a step to move it, and use a step's arrow to link it to another step.
3. Click **Save**. The Studio shows each file that changes, and what changes in it. For each one, copy the new file, open it in GitHub, paste it over the old text, and propose the change.
4. The pull request runs the same check as any other edit. Once someone approves and merges it, the site updates within a few minutes.

The Studio keeps your changes only while the page is open, so save before you close it.

## Change a journey from your browser

1. Open the journey in the Studio and click **View the file on GitHub**, or find it in `website/diagrams/journeys/` on GitHub, and click the pencil to edit.
2. Change the words after the colons. Keep the spaces at the start of each line as they are.
3. Click **Commit changes**, choose **Create a new branch and start a pull request**, and click **Propose changes**.
4. The pull request runs a check. If something is wrong, the check says which file, which step, and what to write instead. Fix it in the same pull request.
5. Once someone approves and merges it, the site updates within a few minutes.

## Change a journey in VS Code or IntelliJ

- **VS Code.** Open the repository and install the YAML extension when VS Code suggests it (Red Hat's). In a journey file you then get a list of allowed values as you type, a short explanation when you hover over a field, and a red underline under any mistake.
- **IntelliJ.** Nothing to install. The second line of each file, `# $schema: ...`, points IntelliJ at the same rules, so you get the same suggestions and warnings.
- A system's name is free text in the editor. The check makes sure it is on the list in `systems.yaml`, so check the spelling there.
- Before you push, you can check every file in a second: `npm run check:diagrams`, run in the `website` folder.

## What a journey file holds

| Field | What it is |
| --- | --- |
| `title`, `eyebrow` | The journey's name, and the small line above it |
| `kind` | `customer` if a customer asks and waits, `system` if something else starts it |
| `origin` | Who starts it (`actor`) and the ways in (`channels`) |
| `entry` | The One-Data functions or inbox it comes in through |
| `core` | The Billpay APIs, Schedules or dispatchers that receive it |
| `workflow` | The Temporal workflows that run it |
| `steps` | The steps, left to right. Each has a `name`, the `state` the payment reaches, and `mode`: `live` (a caller waits), `background` (nobody waits) or `awaiting` (waits for something from outside) |
| `trigger` | On a step: what from outside starts or resumes it, with the event's `name` shown in pink |
| `systems` | On a step: the systems it calls, by their names in `systems.yaml` |
| `reply`, `poll`, `exit` | On a step: where it answers the caller, a call it repeats, and where the payment can end |
| `links` | On a step: lines to other steps in the same journey, each with the step it goes `to` and a `label` saying why, such as retry |
| `detail` | The numbered notes under the diagram. `step` says which step a note explains |
| `reference` | The link to the matching sequence diagram |

Your editor shows the full list, with a line on each field, as you type.

A link names its step by the step's name, so every step in a journey needs its own name. Rename a step in the Studio and its links follow; rename it by hand and change its links to match.

## The two files every journey shares

- **`systems.yaml`** is the list of systems a step can call. Each has a `name`, which journeys use and the lane shows, a `full` name shown on hover, and, for a long name, a `short` one for the lane.
- **`theme.yaml`** sets the colours of every journey, one per kind of part. Each value is a colour's name, and the site draws it in both light and dark:

  | Part | Can be | The site's own |
  | --- | --- | --- |
  | `live-step`, steps a caller waits on | `bright-blue`, `deep-blue`, `deep-400`, `light-blue`, `grey` | `bright-blue` |
  | `background-step`, steps nobody waits on | the same five | `deep-blue` |
  | `awaiting-step`, steps that wait on something outside | `pale-blue`, `pale-deep`, `pale-grey`, or one of the five | `pale-deep` |
  | `trigger`, events from outside | `pink`, or one of the five | `pink` |
  | `call`, calls to other systems | `pale-blue`, `pale-deep`, `pale-grey` | `pale-grey` |
  | `link`, links between steps | the five | `deep-400` |

  Pink is for events from outside only, as everywhere on the site.

## Mistakes that are easy to make

- **Spaces at the start of a line matter.** A step's fields sit two spaces further in than its `- name:` line. Use spaces, not tabs.
- **Put a space after every colon:** `state: PENDING`, not `state:PENDING`.
- **Quote text that starts with a special character.** If a value starts with a backtick, `*`, `[`, `{`, `&`, `!`, `%`, `@`, `#` or a quote, wrap the whole value in double quotes:

  ```yaml
  caption: "`PENDING` with the link"
  ```
- **Long text can run over several lines.** Start it with `>-` and indent the lines under it, as the notes do.

## Adding something new

- **A new system a step can call.** In the Studio, open a step's calls and choose **A system that isn't on the list**. By hand, add it at the end of `systems.yaml`, with its `name` and `full` name.
- **A new journey.** Copy a journey file, rename it (lower case, words joined by hyphens), and change its contents. Then ask whoever looks after the page to add one line to it: `<JourneyMap journey="your-file-name" />`. The Studio lists it once the change is merged.
