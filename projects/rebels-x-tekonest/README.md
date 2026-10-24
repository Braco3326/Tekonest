# Rebels × Tekonest

A separate project: a possible collaboration between **Tekonest** and **Rebels Collectif** around culturally mixed music nights in Paris (Arab music "from the Middle East to Morocco", Afro, electronic).

**This is not Tekonest's identity.** Tekonest is a Paris umbrella for the craft of sound and live production, with three entrances: *Se former*, *Créer avec nous*, *Rejoindre le réseau*. The cultural-mix idea, the nights, the tickets, the deck, the legal guide and the night financial model belong only here.

## Status

Idea stage. **No agreement is signed** with Rebels Collectif. No legal organiser, no venue, no date. All figures are estimates.

## Folders

| Folder | What is in it |
| --- | --- |
| [`PILOT-OVERVIEW.md`](PILOT-OVERVIEW.md) | The former `event-project/README.md`: pilot overview |
| [`docs/`](docs/) | Legal structure guide, meeting brief, working plan, deck notes, "everything explained" |
| [`model/`](model/) | `pilot_model.py`, the financial model for a night |
| [`presentation/`](presentation/) | The deck (.pptx, .pdf, source, web slides) |
| [`tekonest-notes/`](tekonest-notes/) | Tekonest-side notes: the former service vision (`event-programme.md`) and the evidence register (`event-project-register.md`, EV-xx) |
| [`images/`](images/) | Crowd/party image prompts and the concert photo `scene-ambre.*` |
| [`site-prototype-screens/`](site-prototype-screens/) | Screenshots of the removed `soirees.html` page of the site prototype (the page itself is in git history) |

Files were moved with `git mv`, so `git log --follow <file>` keeps their history. Older notes may still say "event-project/" or "event programme": read that as this folder.

## Branches

No branch is only about this project. The branches checked (`git for-each-ref refs/remotes`, 2026-10-24):

- `docs/tekonest-brand-foundation`: brand docs that include the event material, but not only that. Keep.
- `design/tekonest-umbrella-brand`: the umbrella brand and site. Keep.
- `feature/tekpractice-*`, `research/*`: unrelated to this project (they only contain the old `event-project/` path inherited from `main`).

If a Rebels-only branch is created later, name it `rebels-x-tekonest/<name>`.
