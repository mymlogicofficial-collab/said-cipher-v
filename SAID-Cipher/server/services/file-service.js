const fs = require("fs");
const path = require("path");
const guardian = require("./guardian");

const workspaceRoot = process.cwd();

function resolvePath(relativePath) {
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!resolved.startsWith(workspaceRoot)) {
    throw new Error("Path traversal denied");
  }
  return resolved;
}

function listDirectory(dirPath) {
  const resolved = resolvePath(dirPath || ".");
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
      path: path.relative(workspaceRoot, path.join(resolved, e.name)).replace(/\\/g, "/"),
      protected: guardian.isProtected(path.join(resolved, e.name)),
      size: e.isFile() ? fs.statSync(path.join(resolved, e.name)).size : null,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function readFile(filePath) {
  const resolved = resolvePath(filePath);
  const content = fs.readFileSync(resolved, "utf-8");
  return {
    path: filePath,
    content,
    protected: guardian.isProtected(resolved),
    size: Buffer.byteLength(content, "utf-8"),
  };
}

function writeFile(filePath, content) {
  const resolved = resolvePath(filePath);
  guardian.enforceProtection(resolved);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, content, "utf-8");
  return { path: filePath, size: Buffer.byteLength(content, "utf-8") };
}

function createDirectory(dirPath) {
  const resolved = resolvePath(dirPath);
  guardian.enforceProtection(resolved);
  fs.mkdirSync(resolved, { recursive: true });
  return { path: dirPath };
}

function deleteFile(filePath) {
  const resolved = resolvePath(filePath);
  guardian.enforceProtection(resolved);
  if (fs.statSync(resolved).isDirectory()) {
    fs.rmSync(resolved, { recursive: true });
  } else {
    fs.unlinkSync(resolved);
  }
  return { path: filePath, deleted: true };
}

module.exports = { listDirectory, readFile, writeFile, createDirectory, deleteFile, resolvePath };
