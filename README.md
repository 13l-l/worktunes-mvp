# WorkTunes MVP

A simple Pomodoro timer with music and work logging functionality.

## Features

- **Timer**: 25/50 minute presets or custom duration
- **Music**: Built-in Lo-fi, Nature sounds, Jazz + user MP3 uploads
- **Work Log**: Track daily work sessions with time and music used
- **Simple UI**: Clean layout following the hand-drawn specifications

## Getting Started

1. Open `index.html` in your web browser
2. Set your timer duration (25 min default)
3. Choose music category or upload your own MP3s
4. Enter what you're working on
5. Click play to start your focused work session

## File Structure

```
worktunes-mvp/
├── index.html              # Main HTML file
├── src/
│   ├── app.js              # Main application logic
│   └── data/
│       └── freeSounds.js   # Music library configuration
└── README.md
```

## Technical Details

- **Frontend Only**: HTML, CSS (Tailwind), Vanilla JavaScript
- **Storage**: localStorage for work logs and user tracks
- **Audio**: Web Audio API for music playback
- **Limits**: 5 user MP3s max, 10MB per file

## Usage Notes

- Work sessions are automatically logged when timer completes
- Music loops automatically during work sessions
- Only today's work log is displayed
- User tracks are stored locally in browser

## MVP Scope

This is a minimal viable product focusing on core functionality:
- Basic timer with music
- Simple work logging
- User MP3 upload (limited)
- Clean, responsive UI

Future features (Phase 2+):
- User authentication
- Weekly/monthly statistics
- Advanced analytics
- PWA support
- Keyboard shortcuts
