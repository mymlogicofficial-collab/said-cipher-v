# Building S.A.I.D. Cipher for Windows

## One-time setup (takes ~5 minutes)

1. Install Node.js from <https://nodejs.org> (LTS version, 64-bit)
   - During install, check "Automatically install the necessary tools" (this installs build tools for native modules)

2. Download this project folder to your PC

3. Open a terminal (Command Prompt or PowerShell) in the project folder

4. Run:

   ```powershell
   npm install
   npm run build:win
   ```

5. Your installer will be in the `dist/` folder:
   - `S.A.I.D. Cipher Setup 1.0.0.exe` — full installer
   - `SAID-Cipher-1.0.0-portable.exe` — portable version (no install needed)

## Running without building

If you just want to run it without packaging:

   ```powershell
   npm install
   npm start
   ```

## Notes

- The build requires Windows because node-pty (terminal) needs to compile native code for your platform
- You can replace `build/icon.ico` with your own icon before building
- The portable .exe runs from anywhere, no installation required
