import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isPortFree, parsePort, readConfig, resolveListenPort, usernameToEmail } from "./lib.mjs";

test("parsePort accepts the installer range", () => {
  assert.equal(parsePort("42013"), 42013);
  assert.equal(parsePort("1024"), 1024);
  assert.equal(parsePort("65535"), 65535);
  assert.equal(parsePort(" 8080 "), 8080);
});

test("parsePort rejects privileged, huge, and non-numeric ports", () => {
  for (const value of ["80", "1023", "65536", "0", "-1", "abc", "42013.5", "", "42013;1", " 12 "]) {
    assert.throws(() => parsePort(value), /1024 to 65535/);
  }
});

test("usernameToEmail matches the in-app lock", () => {
  assert.equal(usernameToEmail("Owner"), "owner@drivebay.local");
  assert.equal(usernameToEmail("  Ada "), "ada@drivebay.local");
  assert.equal(usernameToEmail("ada@example.com"), "ada@example.com");
  assert.throws(() => usernameToEmail("   "), /Username is required/);
});

test("isPortFree reports a bound port as taken", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  if (port < 1024) {
    server.close();
    return;
  }
  assert.equal(await isPortFree(port), false);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await isPortFree(port), true);
});

test("resolveListenPort keeps a static port and ignores random", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "drivebay-port-"));
  try {
    fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ port: 42013, mode: "regular" }));
    assert.equal(readConfig(home).port, 42013);
    assert.equal(readConfig(home).mode, "regular");
    fs.writeFileSync(path.join(home, "drivebay.port"), "43111");
    assert.equal(resolveListenPort(home, 42013), 43111);
    fs.writeFileSync(path.join(home, "drivebay.port"), "random");
    assert.equal(resolveListenPort(home, 42013), 42013);
    fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ port: 42013, mode: "tailscale", version: "3.18" }));
    assert.equal(readConfig(home).mode, "tailscale");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
