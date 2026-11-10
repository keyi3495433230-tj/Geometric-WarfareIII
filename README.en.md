# Geometric Warfare III — Local Server Edition

**[中文](README.md) | [English](README.en.md)**

The folder retains its historical “Singleplayer” name, but this is a **local-server distribution of the full game**. Gameplay, accounts, friends, rooms and matchmaking use a server running on your computer instead of the public game server. Play alone with zombies or bots, or connect multiple players to the same local server. The original online project is unchanged.

## Quick start

Install **Node.js 24 LTS or newer**, download or clone the repository, then run from its root:

```bash
node start.mjs
```

Alternatively run `npm start`, or double-click `Start-Windows.bat` on Windows. No npm install or separate database service is required. Models, textures and browser libraries are included.

Open **http://127.0.0.1:3080/**. Keep the terminal open; press Ctrl+C to stop. You must start the server first: opening the HTML directly or using static GitHub Pages will not work.

The first launch creates fresh local databases. Public-server accounts and progress are not transferred. Register a local account for persistent rewards and progression, or use the existing guest mode. If the port is busy, close the older process or use `$env:PORT=3081; node start.mjs` in PowerShell.

## Included features

- Classic survival, linear survival, endless and horde modes, with mystery boxes, upgrades, crafting, extraction, bosses, hordes and helicopter gunner support.
- Duels, free-for-all, team deathmatch, demolition, map selection and configurable bots.
- Registration/login, profiles, avatars, backgrounds, medals, mastery, levels, match history and rankings.
- Friends, invitations, private messages, presence, rooms and matchmaking within this server instance.
- Gunsmith, camouflage, local custom textures, charms, loadouts, inspection animations, graphics settings, keyboard remapping and touch controls.
- The `/admin` page remains available, but no administrator password is bundled.
- Intentional visual differences: the laser weapon uses the bundled Quaternius pistol model while retaining laser attacks and upgrade effects; first-person arms are hidden.

Feature parity does not include public-server players or data. The original simulated-population and bot matchmaking logic is retained; displayed counts are not a trustworthy count of real users. Friends, matchmaking and rankings only operate within this server.

## Multiplayer and voice

The default listener is `127.0.0.1`. Separate browser sessions on one computer can connect to it. For LAN play, run in PowerShell:

```powershell
$env:HOST='0.0.0.0'
node start.mjs
```

Other devices open `http://YOUR-LAN-IP:3080/`. Allow the port through your firewall if needed. Players must connect to the same server. This does not automatically publish the game to the Internet.

Microphone, fullscreen and orientation lock depend on browser permissions. Plain HTTP on a LAN address may block microphone access. Cross-device voice may require trusted HTTPS and, depending on the network, ICE/TURN configuration. Retaining voice code does not automatically satisfy these requirements.

## Saves and configuration

- `data/` is created automatically for local accounts, images, match history and progression. Do not upload it.
- Loadouts, graphics, key layouts and custom camouflage also use browser site storage. Different origins, ports or browsers may have separate browser saves.
- Stop the server before backing up `data/`; preserve browser site data for a complete migration.
- To enable administrator password resets, store the SHA-256 hexadecimal digest of your chosen password in a private file, set `GW_ADMIN_HASH` to its absolute path, then start the server. No password or digest is distributed.
- No production databases, server credentials or deployment keys are included.

## Controls

WASD: move; mouse: look; left click: attack; right click: aim; R: reload; F: inspect; E: interact; Shift: sprint; Space: jump; C: crouch/slide; Z: prone; wheel: switch weapon; Esc: pause. Controls can be remapped. Mobile devices use the touch UI when connected to the server.

## Screenshots

All 21 supplied screenshots are shown below. They come from the online edition and development builds. Public hostnames, player data, arms, some weapon models and layout details may differ from this local distribution. Images are preserved unchanged.

![zombie clear](docs/screenshots/zombie-clear.png)

![rocket combat](docs/screenshots/rocket-combat.png)

![street combat](docs/screenshots/street-combat.png)

![battlefield](docs/screenshots/battlefield.png)

![loading](docs/screenshots/loading.png)

![melee](docs/screenshots/melee.png)

![aiming](docs/screenshots/aiming.png)

![corpses](docs/screenshots/corpses.png)

![explosion](docs/screenshots/explosion.png)

![extraction station](docs/screenshots/extraction-station.png)

![profile](docs/screenshots/profile.png)

![operator](docs/screenshots/operator.png)

![attachments](docs/screenshots/attachments.png)

![lighting](docs/screenshots/lighting.png)

![camo](docs/screenshots/camo.png)

![custom camo](docs/screenshots/custom-camo.png)

![extraction horde](docs/screenshots/extraction-horde.png)

![practice](docs/screenshots/practice.png)

![main menu](docs/screenshots/main-menu.png)

![crosshair](docs/screenshots/crosshair.png)

![chopper](docs/screenshots/chopper.png)

## Publishing on GitHub

Use this directory's contents as the repository root. Include `models/`, `docs/`, scripts, documentation and `.gitignore`. Exclude `data/`, password digests and deployment credentials. This is a Node local-server application, not a static GitHub Pages application. No remote repository was created or pushed by this preparation.

See [asset credits and licenses](THIRD_PARTY_NOTICES.md) and the [per-file inventory](ASSET_INVENTORY.csv). Redistribution rights for some user-supplied models and images remain unverified. No blanket MIT or CC0 license has been assigned to this project.

## Development checks

```bash
node --test network.test.cjs encounters.test.mjs survival.test.mjs
```

`start.mjs`: launcher and save paths; `server.mjs`: accounts, rooms and synchronization; `Geometric Warfare3.html`: game; `arena.js`, `match-rules.mjs`, `yard.js`: gameplay; `models/`: assets; `docs/screenshots/`: supplied screenshots. `SOURCE-SNAPSHOT.json` records original source hashes.

## Credits

Generation I and II: greentailtohru. Generation III: GeorgeKy. Game: Geometric Warfare III. Distribution version: v1.0.0.
