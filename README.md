# Pomaxis

Pomaxis is a minimalist Pomodoro timer with soft customizable color moods, lightweight task tracking, daily goals, and installable PWA support.

## Features

- Three timer modes: `Pomodoro`, `Short Break`, and `Long Break`
- Built-in presets: `Classic 25` and `Deep 50`
- Custom durations and background color moods
- Timer state persists across reloads
- Task list with completion tracking
- Daily pomodoro goal tracking
- Keyboard shortcuts for fast control
- Installable Progressive Web App with app icons and cached local assets

## Keyboard Shortcuts

- `Enter`: start the timer
- `Space`: play or pause the timer
- `Escape`: close the customization modal

Shortcuts are ignored while you are typing in inputs or interacting with forms.

## Tech Stack

- HTML, CSS, and JavaScript
- Tailwind via CDN
- `localStorage` for persistence
- web app manifest for PWA support


## Persistence

Pomaxis stores your app state in `localStorage`, including:

- Timer progress
- Selected session
- Custom durations
- Color settings
- Tasks
- Daily goal progress
So even if you refresh the app tab by mistake, you will find your timer resumed!

## Project Structure

- `index.html`: app markup and metadata
- `style.css`: custom styling and motion
- `main.js`: timer logic, persistence, UI behavior, and shortcuts
- `manifest.webmanifest`: PWA manifest
- `sw.js`: service worker
- `pomaxis_logo.png`: original logo asset
- `pomaxis_icon_192.png`: rounded app icon for favicon/PWA
- `pomaxis_icon_512.png`: rounded large app icon for PWA installs
