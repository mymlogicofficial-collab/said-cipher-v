const fs = require("fs");
const path = require("path");

let coreConfig = null;

function loadConfig() {
  if (!coreConfig) {
    const configPath = path.join(__dirname, "../../core/config.json");
    coreConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  return coreConfig;
}

function isProtected(filePath) {
  const config = loadConfig();
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  const relative = path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");

  for (const protectedPath of config.protectedPaths) {
    const cleanProtected = protectedPath.replace(/\\/g, "/");
    if (relative === cleanProtected || relative.startsWith(cleanProtected)) {
      return true;
    }
    if (normalized.endsWith(cleanProtected) || normalized.includes("/" + cleanProtected)) {
      return true;
    }
  }

  for (const pattern of config.protectedPatterns) {
    const ext = pattern.replace("*", "");
    if (relative.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

function enforceProtection(filePath) {
  if (isProtected(filePath)) {
    const error = new Error("ACCESS DENIED: Path is within a protected core zone — " + filePath);
    error.code = "CORE_PROTECTED";
    throw error;
  }
}

function getProtectedPaths() {
  const config = loadConfig();
  return [...config.protectedPaths, ...config.protectedPatterns];
}

function reloadConfig() {
  coreConfig = null;
  return loadConfig();
}

module.exports = { isProtected, enforceProtection, getProtectedPaths, reloadConfig };
