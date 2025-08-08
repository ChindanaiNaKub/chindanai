# Terminal Portfolio

A minimal, keyboard-friendly terminal-style portfolio. Pure HTML/CSS/JS — no build step.

## Features
- Interactive terminal UI with typewriter output and animated backgrounds
- Built-in commands: navigation (ls/cd/cat), theme/background toggles, and portfolio sections
- Zero dependencies; deploy anywhere that serves static files

## Commands
- `help` — list commands
- `whoami` — name and role
- `about`, `skills`, `projects`, `experience`, `education` — info sections
- `contact` — links
- `clear` — clear the screen
- `ls`, `cd`, `cat` — explore a small in-memory filesystem
- `open <url>` — open an external link in a new tab
- `theme <dark|light|matrix>` — switch theme
- `bg <off|particles|matrix|waves>` — background animation
- `typewriter` / `banner` — toggle effects

Keyboard tip: press `/` to focus the input from anywhere.

## Project structure
- `index.html` — markup and terminal container
- `styles.css` — themes and layout
- `script.js` — terminal logic and command handlers (edit `PROFILE` here)

## Quick start (local)
Any static server works. Examples:

Python:
```bash
cd /home/prab/Documents/chindanai
python3 -m http.server 8000
```

Node (npx):
```bash
cd /home/prab/Documents/chindanai
npx --yes serve . -l 8000
```

Open `http://127.0.0.1:8000` and try `help`.

## Customize
1) Open `script.js` and edit the `PROFILE` object (name, email, links, etc.).
2) Update the window title in `index.html` (the text that shows in the fake titlebar).
3) Optional: tweak available projects and contact lines in the `projects`/`contact` commands.

---
Made with plain web technologies so it’s easy to read and modify.
