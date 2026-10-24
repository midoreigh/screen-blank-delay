# Contributing to Screen Blank Delay

Thank you for your interest in contributing! This project follows standard Open Source branching and pull request practices.

---

## 🌳 Branching Strategy

To maintain release stability:

* **`main`**: The primary **release branch**.
  * `main` is protected and **read-only**. Direct pushes are disabled.
  * All updates land in `main` exclusively through Pull Requests.
  * Git tags on `main` trigger automated GitHub Releases.
* **`feature/<feature-name>`**: Use for new features, UI enhancements, or new options (e.g. `feature/timer-presets`).
* **`fix/<bug-name>`**: Use for bug fixes and patches (e.g. `fix/wayland-signal-cleanup`).
* **`docs/<topic>`**: Use for documentation and screenshot improvements.

---

## 🛠️ Development Workflow

### 1. Create a Topic Branch
Start from an up-to-date `main` branch:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
Follow the GNOME Shell extension guidelines:
* Use standard ES Module (`import`) syntax.
* Keep [`extension.js`](extension.js) lifecycle clean: all event signals, timeouts, and UI actors created in `enable()` must be cleanly destroyed and disconnected in `disable()`.
* Ensure [`metadata.json`](metadata.json) reflects accurate versioning and supported GNOME versions.

### 3. Local Testing & Validation
Compile GSettings schemas and package the extension locally:

```bash
# Compile schemas
make schemas

# Package and run Shexli static analyzer
make lint

# Install locally for live testing
make install
```

### 4. Submit a Pull Request
1. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request targeting `main`.
3. Complete the PR template checklist.
4. Ensure the automated GitHub Actions CI passes (`glib-compile-schemas` + `shexli`).

---

## ⚖️ Code Style & Standards

* Clean JavaScript conforming to modern GJS / SpiderMonkey 115+ conventions.
* Shexli static analyzer must report **0 errors, 0 warnings, and 0 findings**.
* License: GPL v3.
