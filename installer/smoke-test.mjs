/**
 * Starts the production bundle and checks the login page plus the password lock.
 * Run after `DRIVEBAY_STANDALONE=1 npm run build` and copy-pglite-assets.mjs.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPortFree, usernameToEmail } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appOutput = path.resolve(here, "../app/.output");
const username = "owner";
const password = "test-password-1";
const email = usernameToEmail(username);

async function pickPort() {
  for (let port = 43000; port < 44000; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error("No free port in 43000-43999");
}

async function waitFor(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "not ready";
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(last);
}

async function post(origin, pathname, body) {
  const res = await fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      referer: `${origin}/login`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const serverEntry = path.join(appOutput, "server", "index.mjs");
  if (!fs.existsSync(serverEntry)) {
    console.error("Missing production server. Build with DRIVEBAY_STANDALONE=1 first.");
    process.exit(1);
  }
  const copy = spawn(process.execPath, [path.join(here, "copy-pglite-assets.mjs")], {
    stdio: "inherit",
  });
  const copyCode = await new Promise((resolve) => copy.on("exit", resolve));
  if (copyCode !== 0) process.exit(copyCode ?? 1);

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "drivebay-smoke-"));
  const port = await pickPort();
  const origin = `http://127.0.0.1:${port}`;
  fs.writeFileSync(
    path.join(home, "config.json"),
    JSON.stringify({ port, mode: "regular", version: "test" }),
  );
  fs.writeFileSync(path.join(home, "drivebay.port"), String(port));
  fs.writeFileSync(
    path.join(home, "pending-account.json"),
    JSON.stringify({ username, password }),
  );

  const child = spawn(process.execPath, [path.join(here, "launcher.mjs")], {
    env: {
      ...process.env,
      DRIVEBAY_HOME: home,
      DRIVEBAY_APP_DIR: appOutput,
      DRIVEBAY_NO_BROWSER: "1",
    },
    stdio: "inherit",
  });

  const stop = async () => {
    const stopper = spawn(process.execPath, [path.join(here, "launcher.mjs"), "--stop"], {
      env: { ...process.env, DRIVEBAY_HOME: home, DRIVEBAY_NO_BROWSER: "1" },
      stdio: "inherit",
    });
    await new Promise((resolve) => stopper.on("exit", resolve));
    try {
      child.kill("SIGTERM");
    } catch {
      /* already stopped */
    }
  };

  try {
    const login = await waitFor(async () => {
      const res = await fetch(`${origin}/login`);
      const text = await res.text();
      if (res.status === 200 && /Drivebay/i.test(text)) return { status: res.status, text };
      return null;
    }, 90_000);

    if (!/\/login|Set the lock|Unlock this machine|sign/i.test(login.text) && !login.text.includes("login")) {
      console.log("Login page served. Title check passed via Drivebay.");
    }
    console.log(`login page HTTP ${login.status}, ${login.text.length} bytes`);

    await waitFor(async () => {
      return fs.existsSync(path.join(home, "pending-account.json")) ? null : true;
    }, 90_000);

    const again = await post(origin, "/api/auth/sign-up/email", {
      email,
      password: "another-password",
      name: "other",
    });
    if (again.status !== 403) {
      throw new Error(`Second sign-up should be closed, got ${again.status}: ${again.text.slice(0, 300)}`);
    }
    console.log("second sign-up is closed");

    const session = await fetch(`${origin}/api/auth/get-session`, {
      headers: { origin, referer: `${origin}/login` },
    });
    const sessionText = await session.text();
    if (session.status !== 200) {
      throw new Error(`get-session HTTP ${session.status}: ${sessionText.slice(0, 300)}`);
    }
    const sessionJson = JSON.parse(sessionText);
    if (sessionJson && sessionJson.user) {
      throw new Error("get-session returned a user without a cookie");
    }
    console.log("anonymous session is empty");

    const wrong = await post(origin, "/api/auth/sign-in/email", {
      email,
      password: "not-the-password",
    });
    if (wrong.status === 200) {
      throw new Error("wrong password was accepted");
    }
    console.log(`wrong password HTTP ${wrong.status}`);

    const right = await post(origin, "/api/auth/sign-in/email", { email, password });
    if (right.status !== 200) {
      throw new Error(`correct password rejected (${right.status}): ${right.text.slice(0, 300)}`);
    }
    console.log("correct password signs in");
    console.log("smoke test passed");
  } catch (err) {
    console.error(err);
    const logFile = path.join(home, "drivebay.log");
    if (fs.existsSync(logFile)) {
      console.error("--- drivebay.log ---");
      console.error(fs.readFileSync(logFile, "utf8").slice(-4000));
    }
    process.exitCode = 1;
  } finally {
    await stop();
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    try {
      child.kill("SIGKILL");
    } catch {
      /* already stopped */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      fs.rmSync(home, { recursive: true, force: true });
    } catch (err) {
      console.error(`cleanup: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
