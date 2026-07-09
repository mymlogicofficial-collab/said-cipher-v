const { execSync, execFileSync } = require("child_process");
const fileService = require("./file-service");
const guardian = require("./guardian");
const cradle = require("./ai-cradle");
const fs = require("fs");
const path = require("path");

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file. Returns the text content. Use for viewing source code, configs, logs, etc.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to the file from project root" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Creates the file if it doesn't exist. Creates parent directories as needed. Cannot write to protected core zones.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to write to" },
          content: { type: "string", description: "Full file content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and directories at a given path. Returns names, types, and sizes.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative directory path. Use '.' for project root" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Execute a shell command and return the output. Use for running scripts, installing packages, checking status, building, testing, etc. Commands run in the project root directory.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image from a text prompt using AI image generation. Returns the image as base64 data.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Description of the image to generate" },
          size: { type: "string", enum: ["1024x1024", "512x512", "256x256"], description: "Image size. Defaults to 1024x1024" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for text or regex patterns across files in the project. Returns matching lines with file paths and line numbers.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Text or regex pattern to search for" },
          path: { type: "string", description: "Directory to search in. Defaults to '.'" },
          file_pattern: { type: "string", description: "Glob pattern to filter files, e.g. '*.js' or '*.py'" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Edit a file by replacing a specific section of text with new text. Use for targeted edits rather than rewriting entire files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to the file" },
          old_text: { type: "string", description: "Exact text to find and replace (must match exactly)" },
          new_text: { type: "string", description: "Text to replace it with" },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
  },
];

function executeTool(name, args) {
  try {
    switch (name) {
      case "read_file": {
        const result = fileService.readFile(args.path);
        if (result.content.length > 50000) {
          return { path: result.path, size: result.size, protected: result.protected, content: result.content.substring(0, 50000) + "\n\n... [truncated, file too large to show fully]" };
        }
        return result;
      }

      case "write_file": {
        const result = fileService.writeFile(args.path, args.content);
        return { success: true, ...result };
      }

      case "list_directory": {
        const entries = fileService.listDirectory(args.path || ".");
        return { path: args.path || ".", entries };
      }

      case "run_command": {
        try {
          const output = execSync(args.command, {
            cwd: process.cwd(),
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          return { success: true, output: output.substring(0, 20000) };
        } catch (e) {
          return {
            success: false,
            exitCode: e.status,
            output: (e.stdout || "").substring(0, 10000),
            error: (e.stderr || e.message || "").substring(0, 10000),
          };
        }
      }

      case "generate_image": {
        return { _async: true, name: "generate_image", args };
      }

      case "search_files": {
        try {
          const grepArgs = ["-rn"];
          if (args.file_pattern) {
            grepArgs.push("--include=" + args.file_pattern);
          }
          grepArgs.push("--exclude-dir=node_modules");
          grepArgs.push("--exclude-dir=.git");
          grepArgs.push("--");
          grepArgs.push(args.pattern);
          grepArgs.push(args.path || ".");

          const output = execFileSync("grep", grepArgs, {
            cwd: process.cwd(),
            timeout: 10000,
            maxBuffer: 512 * 1024,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          const lines = output.trim().split("\n").filter(Boolean);
          const truncated = lines.slice(0, 100).join("\n");
          return { matches: lines.length, output: truncated.substring(0, 15000) };
        } catch (e) {
          if (e.status === 1) return { matches: 0, output: "No matches found." };
          return { error: e.message };
        }
      }

      case "edit_file": {
        const file = fileService.readFile(args.path);
        if (file.protected) {
          return { error: "Cannot edit protected file: " + args.path };
        }
        if (!file.content.includes(args.old_text)) {
          return { error: "Could not find the specified text in the file. Make sure old_text matches exactly." };
        }
        const newContent = file.content.replace(args.old_text, args.new_text);
        const result = fileService.writeFile(args.path, newContent);
        return { success: true, ...result };
      }

      default:
        return { error: "Unknown tool: " + name };
    }
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool };
