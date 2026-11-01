# 📦 LifeMirror Desktop: Zero-Cost Distribution Guide

This directory contains configuration files and manifests for publishing LifeMirror Desktop to official, free community package managers across Windows and macOS.

---

## 1. 🪟 Windows: WinGet (Official Windows Package Manager)

WinGet allows Windows 10/11 users to install LifeMirror with zero browser Mark-of-the-Web (MotW) download warnings:
```powershell
winget install PieApps.LifeMirror
```

### Initial Submission to `microsoft/winget-pkgs`:
1. **Option A (Automated CLI - Recommended)**:
   Install the official `wingetcreate` CLI tool and generate/submit the package:
   ```powershell
   winget install Microsoft.WingetCreate
   wingetcreate new https://github.com/PieApps/lifemirror-desktop/releases/download/v1.3.3/lifemirror-desktop_1.3.3_x64-setup.exe
   ```
   Follow the interactive prompts (use ID: `PieApps.LifeMirror`). The tool can fork and submit the PR automatically with your GitHub account.

2. **Option B (Manual Manifest Validation)**:
   The manifest template is located at `distribution/winget/PieApps.LifeMirror.yaml`.
   - Enable local testing in PowerShell:
     ```powershell
     winget settings --enable LocalManifestFiles
     ```
   - Validate the manifest syntax:
     ```powershell
     winget validate --manifest distribution/winget/PieApps.LifeMirror.yaml
     ```
   - Test installation locally:
     ```powershell
     winget install --manifest distribution/winget/PieApps.LifeMirror.yaml
     ```

### Automated Updates for Future Releases:
For every subsequent release (v1.3.4+), update the package in one command:
```powershell
wingetcreate update PieApps.LifeMirror --submit --version <NEW_VERSION> --urls <URL_TO_NEW_EXE>
```

---

## 2. 🍏 macOS: Homebrew Custom Tap (`homebrew-lifemirror-desktop`)

Because official Homebrew Cask policies on unsigned binaries fluctuate, a dedicated tap provides complete ownership and seamless zero-quarantine installation for Mac users.

### Setup Instructions:
1. Create a public repository on GitHub named:
   `https://github.com/PieApps/homebrew-lifemirror-desktop`
2. Copy `distribution/homebrew/Casks/lifemirror-desktop.rb` into the repository under `Casks/lifemirror-desktop.rb`.
3. Update the `sha256` hashes in the file with the actual SHA-256 values from `SHA256SUMS.txt` of the release.
4. Users can now install LifeMirror Desktop with:
   ```bash
   brew tap PieApps/lifemirror-desktop
   brew install --cask lifemirror-desktop
   ```
   *(The included `postflight` block automatically removes the `com.apple.quarantine` attribute, so the app launches immediately without Gatekeeper prompt).*

---

## 3. 🔐 SLSA Provenance Verification (For Users)

All release binaries compiled by GitHub Actions are attested with SLSA build provenance. Users can verify byte integrity using the GitHub CLI:

```bash
gh attestation verify lifemirror-desktop_1.3.3_x64-setup.exe --repo PieApps/lifemirror-desktop
```

---

## 4. ✍️ Free Code Signing: SignPath Foundation

For qualifying open-source software, **SignPath Foundation** offers free Authenticode signing via GitHub Actions.
- **Program details**: [signpath.io/programs/open-source](https://about.signpath.io/programs/open-source)
- **Requirements**: OSI-approved open source license (MIT), public GitHub repository, published privacy policy, active development.
- **Outcome**: Executables are signed with a trusted certificate (publisher shows as "SignPath Foundation"), eliminating SmartScreen warnings.

