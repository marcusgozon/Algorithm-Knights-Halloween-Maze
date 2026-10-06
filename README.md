# Algorithm Knights Halloween Maze

A pixel-art maze game with a built-in lesson about graphs, DFS + stack, and BFS + queue.

## Folder structure

```
algorithm-knights-maze/
|-- index.html          <- the page (structure + text). Open this one.
|-- README.md           <- this file
|-- assets/
|   |-- bg-music.mp3    <- background music (loops while you play)
|   `-- cheer.mp3       <- plays when you finish the maze
|-- css/
|   `-- style.css       <- colors, fonts, layout (black/red theme lives here)
`-- js/
    |-- maze-logic.js   <- the DSA code: maze builder (DFS + stack), ghost search (BFS + queue)
    `-- game.js         <- drawing, controls, sound, win screen, lesson, quiz
```

## How to run it in VS Code

1. Unzip the folder and open it: File > Open Folder > algorithm-knights-maze
2. Install the extension "Live Server" (by Ritwick Dey).
3. Right-click index.html > "Open with Live Server".
   (You can also double-click index.html. It works without a server.)

You need internet once so the pixel fonts load from Google Fonts. Without internet the game still works with a plain font.

## Sound

- Music tries to start as soon as the page opens. Browsers often block sound until the first tap, click, or key press, so if that happens it starts on the first one.
- Music fades out and the cheer plays when you escape.
- The Music and Effects sliders sit under the maze. Effects controls the cheer and the little game beeps. Volumes are remembered.
- To use other sounds, replace the files in assets/ and keep the same names (or change the names in the two <audio> tags in index.html).
- On iPhone and iPad the sliders cannot change the volume (Apple blocks it). Use the phone's volume buttons there.

## Where to change things

| I want to change...              | Open this file         | Look for                          |
|----------------------------------|------------------------|-----------------------------------|
| Title, menu text, lesson words   | index.html             | the text inside the tags          |
| Colors of the page               | css/style.css          | `:root { --accent: ... }`         |
| Maze size, ghost speed, candy    | js/game.js             | `const DIFF = {...}` (top)        |
| Colors of walls and floor        | js/game.js             | `drawHedge` and `drawFloor`       |
| How the maze is built            | js/maze-logic.js       | `generate()`                      |
| How the ghost chases             | js/maze-logic.js       | `bfs()`                           |
| Sound file names                 | index.html             | the two `<audio>` tags            |
| Quiz questions                   | js/game.js             | `const QUIZ = [...]`              |

## Share the same maze with everyone

Type the same "seed" (for example WITCH-31) on the menu. Same seed + same level = same maze.
