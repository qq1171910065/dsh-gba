# Screenshots

Screenshots used by the READMEs.

| File | Shows |
| --- | --- |
| `screenshot-library.png` | The panel on the **All** tab: heading with *ROM folders* / *Add ROM*, the tab bar, the search field, library rows. |
| `screenshot-detail.png` | A game's own page: the crumb, the title row with the Save Center, the description block with the big Play button, the control grid and the group chips. |
| `screenshot-window.png` | The floating window with its toolbar showing. |

The committed files were cropped from real screenshots of the panel; there is no capture
script, since that needs a live Harness session.

To redo them by hand:

1. Run the Harness at 1217×820 or larger, light theme (the panel is theme-neutral but the
   screenshots happen to be light).
2. Capture the window, then crop away the OS title bar at the top and the sidebar's account
   block at the bottom — those carry a balance and version badge that do not belong in a
   screenshot.
3. Save as PNG with a 1 px `#e2e6ea` border so the white panel does not merge into GitHub's
   background.
4. Keep each file under ~150 KB.

The window shot is simply the floating player cropped out of the library screenshot with a
14 px margin so its drop shadow survives.

Please avoid commercial titles in these images so they match what the bundle actually ships.
