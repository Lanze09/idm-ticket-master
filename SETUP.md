# Setup guide — IDM Ticket Master

A step-by-step walkthrough for getting this app running on your computer, written for people who have never run a developer project before. Every step includes a copy-paste command and a "✅ what success looks like" line.

> **Time required:** ~10 minutes the first time. ~30 seconds every time after that.

---

## TL;DR (for the impatient)

```bash
git clone https://github.com/Lanze09/idm-ticket-master.git
cd idm-ticket-master
cp .env.example .env.local       # on Windows PowerShell: Copy-Item .env.example .env.local
npm install
npm run dev
# Open http://localhost:3000
```

Sign in with `admin@idm.com` / `admin123`.

---

## Step 1 — Install the prerequisites (one-time only)

You need two free programs installed. If you've ever used GitHub before, you probably already have them.

### 1a. Install Git

Git is what downloads (clones) the project from GitHub.

- **Windows:** download from https://git-scm.com/download/win and run the installer (use the defaults)
- **Mac:** open **Terminal** and run `xcode-select --install`, OR install from https://git-scm.com/download/mac
- **Linux:** `sudo apt install git` (Ubuntu) or your distro's equivalent

✅ **Confirm it worked:** open a terminal and type `git --version`. You should see something like `git version 2.43.0`.

### 1b. Install Node.js (version 20 or newer)

Node.js is what runs the website on your computer.

- Go to https://nodejs.org/
- Click the big green **LTS** button (currently "20.x" or "22.x")
- Run the installer with defaults

✅ **Confirm it worked:** open a **new** terminal window (must be new — old ones won't see the new install) and type:
```
node --version
npm --version
```
You should see two version numbers like `v20.18.0` and `10.8.2`. **If `node` isn't found**, restart your computer and try again.

> **Windows note:** if `node` is still not found after a restart, see [Troubleshooting → "node is not recognized"](#troubleshooting) below.

---

## Step 2 — Open a terminal in the right place

You need a terminal (a black/white window where you type commands).

### Windows
1. Press the **Windows key**, type **PowerShell**, press Enter.
2. In PowerShell, navigate to wherever you want this project to live (e.g. your Documents folder):
   ```powershell
   cd "$env:USERPROFILE\Documents"
   ```

### Mac / Linux
1. Open **Terminal** (Cmd+Space, type "Terminal", press Enter).
2. Navigate to wherever you want the project to live:
   ```bash
   cd ~/Documents
   ```

✅ **Confirm:** the prompt should show your current folder.

---

## Step 3 — Download the project

Copy-paste this into the terminal:
```bash
git clone https://github.com/Lanze09/idm-ticket-master.git
cd idm-ticket-master
```

✅ **What success looks like:**
```
Cloning into 'idm-ticket-master'...
remote: Enumerating objects: 44, done.
Receiving objects: 100% (44/44), done.
```

You're now sitting inside the project folder. Everything from here happens inside this folder.

---

## Step 4 — Create your local config file

The project ships with `.env.example` (a template). You need to make your own copy called `.env.local`.

### Windows PowerShell
```powershell
Copy-Item .env.example .env.local
```

### Mac / Linux
```bash
cp .env.example .env.local
```

✅ **Confirm:** type `ls .env*` (Mac/Linux) or `dir .env*` (Windows). You should see both `.env.example` and `.env.local`.

> **Do you need to change anything in `.env.local`?**
> For local development: **No** — it works as-is.
> For production deployment: yes, change `AUTH_SECRET` to a long random string. You can generate one at https://generate-secret.vercel.app/32

---

## Step 5 — Install the project's dependencies

This downloads ~400 small libraries the project depends on. It takes 1–3 minutes.

```bash
npm install
```

✅ **What success looks like (the last line):**
```
added 401 packages, and audited 402 packages in 1m
```

You'll see warnings about "deprecated packages" and "vulnerabilities" — **ignore them**. Those are harmless for a local demo.

You'll now have a `node_modules/` folder — that's where the libraries live. **Never commit it to git** (the `.gitignore` already prevents that).

---

## Step 6 — Start the website

```bash
npm run dev
```

✅ **What success looks like:**
```
▲ Next.js 14.2.15
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Ready in 3.6s
```

🎉 **The app is running.** Open your browser and go to:

### **👉 http://localhost:3000**

---

## Step 7 — Sign in and explore

The login page shows a list of demo accounts you can click on. They auto-fill the form for you.

| Click this account | Then click "Sign in" — you'll see |
|---|---|
| **Admin (full access)** | Global view of all 3 demo projects, SLA timers, severity controls, escalation, full audit trails |
| **Northwind user** | Only Northwind tickets. Severity is read-only. SLA columns are hidden. |
| **Contoso user** | Only Contoso tickets. |
| **Multi-project user** | Tickets from both Northwind and Fabrikam (a user assigned to multiple projects). |

### Things to try
1. **As admin:** open ticket #1, change Status from New → Open. Watch the SLA timer start. Notice the entry that automatically appeared in the **Activities** tab.
2. **As admin:** open ticket #3 (the Production / Go-Live one). Notice it's marked High priority and "On track" — that's the priority engine deriving High from the Production flag, not the user setting it.
3. **As a user:** try opening `/dashboard/tickets/3` directly in the URL bar. You'll get "Not Found" — the project privacy check at work.
4. **Create a new ticket:** click "+ Create ticket" at the top right. Notice that Ticket Number, Created By, Date Created, and Project are auto-filled and read-only.
5. **Watch email notifications:** look at the terminal where you ran `npm run dev`. Every time you save or change a ticket, you'll see an `[email:mock]` log showing what email *would* have been sent. (Set real SMTP creds in `.env.local` to send for real.)

---

## Step 8 — Stop the server when you're done

In the terminal where the server is running:
- Press **Ctrl + C** (Windows/Linux) or **Cmd + C** (Mac)
- Confirm with **Y** if asked

You can close the terminal window. The website is now offline. To restart it later, just open a terminal in the project folder and run `npm run dev` again.

---

## Troubleshooting

### "git is not recognized" / "command not found: git"
Git isn't installed, or your terminal was open before you installed it. **Open a new terminal**, or restart your computer.

### "node is not recognized" / "command not found: node"
Same as above — Node.js isn't installed or the terminal is stale. **Close every terminal window**, then open a brand new one. If that still doesn't work on Windows, restart the computer.

### "Port 3000 is already in use"
Something else is using port 3000 (maybe a previous run of this app). Either:
- Find and stop the other process, or
- Run on a different port: `npm run dev -- -p 3001` and visit http://localhost:3001

### `npm install` fails with "EACCES" or permission errors (Mac/Linux)
Don't use `sudo`. Instead, run `npm install` from a folder you own (your home directory).

### `npm install` fails with `node-gyp` / `Visual Studio` errors (Windows)
This project intentionally uses **Node 20+'s built-in SQLite** so you don't need Visual Studio. If you're seeing this error, it means an older Node is on your PATH. Make sure `node --version` shows **v20 or newer**.

### Login says "Invalid credentials"
Use the demo accounts shown on the login page (click them to auto-fill). The first time you sign in, the database is auto-created and seeded.

### I want to wipe the database and start fresh

**Option A (recommended):** stop the server, then run the reset script:
```bash
npm run db:reset
```
This deletes the SQLite file and re-runs the seed in one step. You'll be back to the demo accounts and three sample tickets.

**Option B (manual):** stop the server (Ctrl+C), then delete the `data/` folder:
```bash
# Mac / Linux
rm -rf data
# Windows PowerShell
Remove-Item data -Recurse -Force
```
Next time you run `npm run dev` and sign in, the database and demo data will be re-created from scratch.

### How do I just populate demo data without launching the app (e.g. on a Linux server)?
```bash
npm run db:seed
```
Idempotent — if users already exist, it does nothing. Useful when you want the demo accounts and sample tickets ready *before* anyone logs in for the first time.

### How do I update to the latest version of this project?
```bash
git pull
npm install         # only needed if dependencies changed
npm run dev
```

### I want to expose this so a colleague on another computer can see it
For a quick demo, use [ngrok](https://ngrok.com/) or [cloudflared](https://github.com/cloudflare/cloudflared):
```bash
ngrok http 3000
```
ngrok will give you a public URL like `https://random-name.ngrok-free.app` that anyone can open. **Don't leave it running long-term** — it's a demo tunnel, not production hosting.

For real production: deploy to [Vercel](https://vercel.com/) (free for hobby projects) — `npm i -g vercel && vercel`. You'll need a real database (Vercel doesn't keep SQLite files).

---

## Where to ask for help

- **README.md** in this same folder — explains *what* this app does and lists the design decisions
- **GitHub Issues** at https://github.com/Lanze09/idm-ticket-master/issues — log a bug or request a feature
- **The terminal** where `npm run dev` is running — error messages there are usually the most useful clue

Welcome aboard!
