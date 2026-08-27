import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("foreground launcher waits for local WebUI before minimizing the console", async () => {
	const source = await readFile(new URL("../scripts/launch-dsh-foreground.ps1", import.meta.url), "utf8");

	assert.match(source, /Invoke-WebRequest -Uri \$uri -TimeoutSec 2/);
	assert.match(source, /127\.0\.0\.1/);
	assert.match(source, /GetConsoleWindow\(\)/);
	assert.match(source, /ShowWindow\(IntPtr hWnd, int nCmdShow\)/);
	assert.match(source, /SW_MINIMIZE = 6/);
	assert.match(source, /-NoNewWindow/);
	assert.match(source, /"--profile", "web"/);
	assert.match(source, /\$dshProcess\.WaitForExit\(\)/);
	assert.doesNotMatch(source, /SW_HIDE/);

	const minimizeIndex = source.indexOf("[void](Minimize-ForegroundTerminal)");
	const waitIndex = source.indexOf("$dshProcess.WaitForExit()");
	assert.ok(minimizeIndex >= 0 && minimizeIndex < waitIndex);
});
