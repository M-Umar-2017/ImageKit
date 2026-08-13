# Amber Convert — Design Direction

## Three stylistic approaches

### Theme Name: Archive Desk
Very dark, editorial utility with warm amber controls and a classical serif interface. It treats file conversion like a precise studio workflow rather than a generic upload form.
**Probability:** 0.07

### Theme Name: Ember Terminal
A restrained black workspace with orange signal markers, thin rules, and a slightly technical rhythm. It feels fast, focused, and quietly industrial without leaning into neon.
**Probability:** 0.03

### Theme Name: Paper Cutout
A warm off-black canvas with cream panels and orange annotations, referencing a printmaker's worktable. It is tactile and friendly while still keeping the tool compact.
**Probability:** 0.05

## Chosen approach: Archive Desk for ImageKit

### Design Movement
Contemporary editorial modernism informed by Swiss utility graphics and the quiet precision of a 20th-century archive desk.

### Core Principles
1. Make the conversion state legible at a glance through horizontal, document-like rows.
2. Use contrast sparingly: amber marks actions and progress; black carries the working surface.
3. Give controls a tactile, print-inspired feel through hairline rules, measured spacing, and serif typography.
4. Keep the interface calm and direct: no decorative clutter, no unnecessary panels.

### Color Philosophy
Black is the neutral archive surface, creating focus and a sense of dependable local processing. Amber is reserved for action, selection, and successful progress so it reads as a physical tab or stamp rather than a generic accent. Soft parchment is used only where content needs to breathe, keeping the experience classical without becoming vintage-themed.

### Layout Paradigm
A left-anchored editorial header establishes the tool, followed by a large asymmetric workbench: the upload zone occupies the visual lead while the conversion controls sit as a narrow vertical index. Results extend below as full-width horizontal file records, echoing a catalog ledger.

### Signature Elements
- Thin amber registration marks at key section corners.
- File rows styled as catalog cards with compact format chips and a preview aperture.
- A small uppercase utility label system paired with oversized serif titles.

### Interaction Philosophy
Every interaction should feel like a deliberate desk action: selecting a format updates the conversion promise immediately, adding files appends them without resetting the workbench, and processing advances one record at a time. Hover states use a restrained paper-lift motion; active buttons compress slightly and show a clear amber confirmation.

### Animation
Use short, physical transitions under 240ms with a cubic-bezier ease-out. New file rows enter with a subtle upward translate and opacity reveal, staggered by 45ms. Processing indicators use a linear amber sweep only while active. Respect reduced-motion preferences by disabling transforms and keeping state changes instantaneous.

### Typography System
Use Cormorant Garamond for display headings and labels that need character, paired with IBM Plex Mono for filenames, format metadata, and status. Body copy uses Cormorant Garamond at a readable size. Hierarchy relies on scale and tracking rather than heavy weight; avoid Inter and avoid excessive bolding.

### Brand Essence
ImageKit is a focused browser workbench for people who need to move image files between formats without losing their place. **Precise, warm, composed.**

### Brand Voice
Headlines are brief and declarative. CTAs sound like direct desk instructions; status copy explains what is happening without hype. ImageKit is the only public product name.

Example lines:
- “Change the file. Keep the frame.”
- “Process the stack, one image at a time.”

### Wordmark & Logo
The ImageKit mark is a compact amber registration cross nested inside a black square, suggesting both a crop guide and a file stamp. The wordmark is set in a high-contrast serif with a deliberately offset “I” registration detail; the symbol is used independently as the favicon and header mark.

### Signature Brand Color
Burnished Amber — `#E87524`, used only for the active conversion path, progress, and primary action.
