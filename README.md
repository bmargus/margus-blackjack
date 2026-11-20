# Margus Blackjack

A multiplayer, server-synchronized blackjack game for Brad, Jarrett, and Quinn, with two animated computer opponents and a computer dealer.

## Deploy to Render

1. Create a new GitHub repository named `margus-blackjack`.
2. Upload **the contents of this folder** to the root of the repository. `server.js`, `package.json`, and the `public` folder should all be in the repository root.
3. On Render, create a **Web Service** connected to that repository.
4. Set **Runtime** to Node, **Build Command** to `npm install`, and **Start Command** to `npm start`.
5. Use one shared Render service URL on everyone's devices. The first player selects 2 or 3 human players and opens the casino. Each player then chooses their own name.

## Gameplay

- Six decks, dealer stands on soft 17, natural blackjack pays 3:2.
- Double on any first two cards; double after split; up to four hands via splitting; split aces get one additional card each.
- No insurance, surrender, side bets, or real money.
- All selected human players must connect and place their bets before the deal starts.
- The dealer and bot dialogue uses your browser's built-in text-to-speech. Available voices and their quality vary by browser/device. Click a button to enable sound; adjust volume in the header.
- This version uses emoji-based animated character representations and browser effects, not custom 3D character animation or professional recorded voices.
- State is stored in the server's memory and resets on server restart. A single game table is shared by all visitors.

## Local test

```sh
npm install
npm start
```

Visit `http://localhost:3000` in a browser.
