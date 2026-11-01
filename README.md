# Music Tools for All

Free, browser-only tools for learning and practising Carnatic music,
published at **https://musictoolsforall.github.io/**.

| Tool | Folder | What it does |
|---|---|---|
| Swara Notes | [`swara-notes/`](swara-notes/) | Swaras and gamaka marks above Tamil/English lyrics, with a looping recording player |

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000   (not 0.0.0.0:8000)
```

## Add a new tool

1. Put it in its own folder with an `index.html`, using only relative links.
2. Add a card for it in the root `index.html` and a row in the table above.

## Privacy

No tool uploads lyrics, recordings or songs. Data stays in the visitor's
browser. Don't commit song lyrics or recordings to this repository.
