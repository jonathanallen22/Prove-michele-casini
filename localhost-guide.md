# How to run Antitesi Magazine on a local server

This guide walks you through running the Antitesi website on your computer. No coding skills needed — just follow the steps for your system.

---

## What You'll Need

- A Mac, Linux, or Windows PC
- The website folder as a `.zip` file
- About 5 minutes

---

## Step 0 — Unzip the Folder

Move the `.zip` file somewhere easy to find — your Desktop is fine. Then extract it:

- **Mac:** Double-click it. macOS creates a folder automatically.
- **Linux:** Right-click → *Extract Here*, or run `unzip antitesi.zip` in the terminal.
- **Windows:** Right-click → *Extract All*, then click *Extract*.

> Don't rename the folder or move files around inside it. Everything needs to stay in place.

<!-- SCREENSHOT: The unzipped folder on the Desktop -->

---

## Step 1 — Check if Python Is Installed

### Mac
Open **Terminal** (`Cmd + Space`, type "Terminal", press Enter) and run:
```
python3 --version
```
If you see `Python 3.x.x` — skip to **Step 3**. Otherwise go to **Step 2**.

<!-- SCREENSHOT: Spotlight search showing Terminal -->
<!-- SCREENSHOT: Terminal showing python3 --version output -->

### Linux
Open a terminal and run:
```
python3 --version
```
Most Linux distros come with Python pre-installed. If not, install it with:
```
sudo apt install python3      # Debian/Ubuntu
sudo dnf install python3      # Fedora
```

### Windows
Open **Command Prompt** (press `Win + R`, type `cmd`, press Enter) and run:
```
python --version
```
If you get an error or it opens the Microsoft Store instead, go to **Step 2**.

---

## Step 2 — Install Python *(only if Step 1 didn't work)*

1. Go to [python.org/downloads](https://www.python.org/downloads/)
2. Click **Download Python** and open the installer
3. **Windows only:** make sure to check **"Add Python to PATH"** before clicking Install
4. Once installed, close and reopen the terminal, then try `python3 --version` again

<!-- SCREENSHOT: python.org download page -->
<!-- SCREENSHOT: The installer window -->

---

## Step 3 — Navigate to the Folder

### Mac
1. In Terminal, type `cd ` (with a space, don't press Enter yet)
2. **Drag the unzipped folder** from Finder into the Terminal window — it pastes the path automatically
3. Press Enter

### Linux
1. In the terminal, type `cd ` then drag the folder into the terminal window, or type the path manually:
```
cd /home/yourname/Desktop/antitesi_
```

### Windows
1. Open the unzipped folder in File Explorer
2. Click the address bar at the top, type `cmd`, and press Enter — this opens Command Prompt already pointed at that folder

> **Check you're in the right place:** type `ls` (Mac/Linux) or `dir` (Windows) and press Enter. You should see files like `index.html`, `js/perry-lee.js`, etc.

<!-- SCREENSHOT: Dragging the folder into Terminal -->
<!-- SCREENSHOT: Terminal after cd + ls showing the file list -->

---

## Step 4 — Start the Server

### Mac / Linux
```
bash server.sh
```

### Windows
Double-click `server.bat` in the folder. A black window will open — that's the server running.

You should see:
```
Serving on http://localhost:8000
```

**Don't close this window** — it needs to stay open while you browse the site.

<!-- SCREENSHOT: Terminal showing the server running -->

---

## Step 5 — Open the Website

Open any browser and go to:
```
http://localhost:8000
```

You should see the Antitesi Magazine homepage.

<!-- SCREENSHOT: The homepage in a browser -->

---

## Bonus — Open the Site on Your Phone

You can browse the site from your phone as long as it's connected to the **same Wi-Fi network** as your computer.

### Find your computer's local IP address

**Mac:** Go to *System Settings → Wi-Fi → Details* (next to your network name). Look for the **IP Address** field — something like `192.168.1.42`.

Alternatively, open Terminal and run:
```
ipconfig getifaddr en0
```

**Linux:** Run:
```
ip addr show
```
Look for `inet` followed by an address like `192.168.1.42` under your Wi-Fi interface (usually `wlan0` or `wlp2s0`).

**Windows:** Open Command Prompt and run:
```
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi adapter — something like `192.168.1.42`.

### Connect from your phone

With the server still running on your computer, open your phone's browser and go to:
```
http://192.168.1.42:8000
```
(replace `192.168.1.42` with your actual IP address)

> If it doesn't connect, your computer's firewall may be blocking port 8000. On Windows, you may get a firewall prompt when you first start the server — click *Allow*.

---

## When You're Done

Press `Ctrl + C` in the terminal to stop the server. Next time, just repeat Steps 3–5.