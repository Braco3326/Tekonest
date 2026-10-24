# Contrôles de TekPractice / TekPractice controls

Référence : [ADR-0010](adr/0010-explore-controls.md) (vue Exploration) et [ADR-0008](adr/0008-focus-patch-camera.md) (Focus & Patch). Toutes les touches se changent dans **Réglages → Touches** et sont enregistrées dans le navigateur.
Reference: ADR-0010 (Explore view) and ADR-0008 (Focus & Patch). Every key can be remapped in **Réglages → Touches** (saved in the browser).

## Trois vues / Three views

```
            V (ou bouton « Vue »)
  ┌──────────────┐  ◄──────────►  ┌──────────────┐
  │  EXPLORATION │                │    ORBITE    │
  │  (marcher)   │                │ (tourner     │
  │  Sandbox     │                │  autour)     │
  │  par défaut  │                │  Niveaux A1–D1, examen
  └──────┬───────┘                └──────┬───────┘   par défaut
         │ clic sur un appareil / F       │ clic / double-clic / Tab + Entrée
         ▼                                ▼
      ┌─────────────────────────────────────────┐
      │      FOCUS & PATCH (ADR-0008)            │
      │  clic sur un port = prendre / brancher   │
      │  Échap / clic droit = revenir            │
      └─────────────────────────────────────────┘
```

- **Exploration / Explore**: you walk through the room at eye height. It is the default in the Sandbox, and available in levels with `V` or `?view=explore`.
- **Orbite / Orbit**: the camera turns around the gear, as before. It is the default in levels A1–D1 and in the exam.
- **Focus**: the camera frames one device so you can patch its ports. The ADR-0008 rules are unchanged.

## Clavier + souris / Keyboard + mouse

Keys follow the **physical position** on the keyboard (`KeyboardEvent.code`). The help overlay (`H`) shows the letter your layout prints on the key.

```
 AZERTY (FR)                         QWERTY (EN)
 ┌───┬───┬───┐                       ┌───┬───┬───┐
 │ A │ Z │ E │   A/Q = descendre     │ Q │ W │ E │   Q = down
 ├───┼───┼───┤   E   = monter      ├───┼───┼───┤   E = up
 │ Q │ S │ D │   Z/S = avancer/reculer │ A │ S │ D │   W/S = forward/back
 └───┴───┴───┘   Q/D = pas de côté   └───┴───┴───┘   A/D = strafe
 Maj = plus vite / run · Espace = inventaire / inventory (no jump)
```

| Touche (AZERTY) | Key (QWERTY) | Action (FR) | Action (EN) |
|---|---|---|---|
| Z / S | W / S | Avancer / reculer | Move forward / back |
| Q / D | A / D | Pas à gauche / à droite | Strafe left / right |
| A / E | Q / E | Descendre / monter (s'accroupir) | Move down / up (crouch) |
| Maj | Shift | Marcher plus vite | Walk faster |
| Espace | Space | Ouvrir / fermer l'inventaire | Toggle inventory |
| Souris (capturée) | Mouse (locked) | Regarder | Look around |
| ← / → | ← / → | Tourner (accès clavier seul) | Turn (keyboard-only access) |
| Page ↑ / Page ↓ | Page Up / Down | Regarder en haut / en bas | Look up / down |
| F | F | Focus sur l'appareil visé | Focus the aimed device |
| X | X | Ramasser l'appareil visé (Sandbox) | Pick up the aimed device (Sandbox) |
| R | R | Tourner l'objet à poser (90°) | Rotate the object being placed |
| V | V | Exploration ⇄ Orbite | Explore ⇄ Orbit |
| H | H | Aide des contrôles | Controls help |
| Alt + H | Alt + H | Vue d'ensemble (aussi le bouton « Vue d'ensemble ») | Overview (also the "Vue d'ensemble" button) |
| Échap | Esc | Voir « Échap » ci-dessous | See "Esc" below |

**Pointer capture (auto)**: clicking empty floor captures the mouse **once you have walked with the keyboard**. After that, a crosshair appears, a click focuses the device under it, and Esc frees the mouse. This can be changed in Réglages (auto / always / never).

## Souris seule / Mouse only

```
   bouton gauche maintenu         bouton droit maintenu
   + glisser = regarder           + glisser = « joystick »
        ← ↑ ↓ →                        ↑ avancer
                                   ←  pas de côté  →
                                        ↓ reculer
   clic gauche (sans glisser) = interagir (focus, port)
   molette = zoom (champ de vision)
```

| Geste | Gesture | Action |
|---|---|---|
| Gauche maintenu + glisser | Left drag | Regarder / look |
| Droit maintenu + glisser ↑ / ↓ | Right drag up / down | Avancer / reculer — forward / back |
| Droit maintenu + glisser ← / → | Right drag left / right | Pas de côté — strafe |
| Clic gauche sans glisser | Left click (no drag) | Focus d'un appareil, clic sur un port — focus, click a port |
| Molette | Wheel | Zoom par champ de vision — FOV zoom |

A gesture counts as a drag once the mouse has moved 10 px, the same threshold Babylon uses, so it is never also read as a click.

## Vue Orbite / Orbit view

Inspired by pro acoustic-design and 3D modelling tools (ADR-0008 addendum, 2026-10-24). The help overlay (`H`) lists the same gestures under « Vue Orbite ».

| Geste | Gesture | Action |
|---|---|---|
| Clic sur un appareil | Click a device | Focus : la vue tourne autour de cet appareil — focus, the view turns around it (a double-click works too) |
| Clic gauche maintenu + glisser | Left drag | Tourner autour du point de pivot — orbit around the pivot |
| Clic droit maintenu + glisser, Maj + glisser ou Ctrl + glisser | Right drag, Shift + left drag or Ctrl + left drag | Déplacer la vue (panoramique) — pan |
| Molette | Wheel | Avancer vers le curseur ou reculer — dolly toward the cursor |
| Double-clic sur le sol | Double-click the floor | Tourner autour de ce point du sol — re-pivot there (floors only, never walls; angle and distance kept) |
| Alt + H ou bouton « Vue d'ensemble » | Alt + H or the "Vue d'ensemble" button | Revenir à la vue d'ensemble — back to the overview (a cable in hand is kept) |

The camera keeps a little inertia and never goes under the floor. In Focus you can come as close as 1.2 × the device size. In Explore (walking) none of this applies: the floor double-click, `Alt + H` and the « Vue d'ensemble » button only act on the orbit camera.

## Échap / Esc (order of priority)

1. The mouse is captured: Esc frees it.
2. Placing an object: Esc cancels the placement.
3. A panel is open (inventory, help, settings, pause): Esc closes the top one.
4. A cable is in hand: Esc drops it (ADR-0008).
5. In Focus: Esc goes back to Explore or Orbit.
6. In Explore with nothing open: Esc opens the pause menu.

## Inventaire et pose / Inventory and placement

- **Space** opens the catalog, grouped by category, with search and a short sheet for each device: key specs, connectors and a link to the official manual (source: `knowledge-base/`).
- **Sandbox**:
  1. Click **Placer dans le monde**, then aim at the floor. The object snaps to a 0.25 m grid.
  2. **R** turns it.
  3. Click to place it, or press **Échap** to cancel.
  4. **X** on a device picks it up (its cables are unplugged), with **Annuler** in the message to undo.
- In a level, the inventory is read-only: the gear is already in place.

## Salles générées / Generated rooms

`?level=sandbox&room=<id>` (or the selector in the shelves) builds one of the 32 TEK Brain rooms: concert hall, radio studio, theatre and so on. You start at the front-of-house desk (or the control room) facing the stage. Stage decks are raised, and your eye rises with them.

## Accessibilité / Accessibility

- **Keyboard only**: walk with the arrow keys and the movement keys, and focus a device with Tab + Enter (ADR-0008).
- **Panels**: they are dialogs. Tab cycles inside them, Esc closes them, and focus goes back to where it was.
- **Reduced motion**: follows the system setting, or can be forced in Réglages. Camera flights become cuts and acceleration is shortened.
- Touch and gamepad: not in this version. The input layer (`src/input/actions.ts`) is ready for them.
