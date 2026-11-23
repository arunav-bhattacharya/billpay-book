# Editing the diagrams

The words in the site's diagrams live in the plain-text files in this folder, one file per diagram. You can change a step's name, a state, an event or a note without knowing any React, and the diagram redraws itself.

For now this covers the 19 journeys on **Design > Journeys > All Journeys**, in `journeys/`. Other diagrams will move here the same way.

## Change a journey from your browser

1. Open the journey on the site and click **Edit this diagram** at its top right. GitHub opens the file, ready to edit.
2. Change the words after the colons. Keep the spaces at the start of each line as they are.
3. Click **Commit changes**, choose **Create a new branch and start a pull request**, and click **Propose changes**.
4. The pull request runs a check. If something is wrong, the check says which file, which step, and what to write instead. Fix it in the same pull request.
5. Once someone approves and merges it, the site updates within a few minutes.

## Change a journey in VS Code or IntelliJ

- **VS Code.** Open the repository and install the YAML extension when VS Code suggests it (Red Hat's). In a journey file you then get a list of allowed values as you type, a short explanation when you hover over a field, and a red underline under any mistake.
- **IntelliJ.** Nothing to install. The second line of each file, `# $schema: ...`, points IntelliJ at the same rules, so you get the same suggestions and warnings.
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
| `systems` | On a step: the systems it calls, from a fixed list |
| `reply`, `poll`, `exit` | On a step: where it answers the caller, a call it repeats, and where the payment can end |
| `detail` | The numbered notes under the diagram. `step` says which step a note explains |
| `reference` | The link to the matching sequence diagram |

Your editor shows the full list, with a line on each field, as you type.

## Mistakes that are easy to make

- **Spaces at the start of a line matter.** A step's fields sit two spaces further in than its `- name:` line. Use spaces, not tabs.
- **Put a space after every colon:** `state: PENDING`, not `state:PENDING`.
- **Quote text that starts with a special character.** If a value starts with a backtick, `*`, `[`, `{`, `&`, `!`, `%`, `@`, `#` or a quote, wrap the whole value in double quotes:

  ```yaml
  caption: "`PENDING` with the link"
  ```
- **Long text can run over several lines.** Start it with `>-` and indent the lines under it, as the notes do.

## Adding something new

- **A new journey.** Copy a journey file, rename it (lower case, words joined by hyphens), and change its contents. Then ask whoever looks after the page to add one line to it: `<JourneyMap journey="your-file-name" />`.
- **A new system a step can call.** Add its short name to the `enum` list under `systems` in `schemas/journey.schema.json`, and its full name, in the same position, to the `enumDescriptions` list just below. The full name is what the diagram shows on hover.
