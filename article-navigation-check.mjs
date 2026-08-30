import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const HOST = '127.0.0.1';
const ARTICLE_PATH = '/blog/posts/os/ostep/log';
const LONG_SERIES_PATH = '/blog/posts/SystemDesign/topk';
const WSS_CANARY_HOST = 'article-navigation-canary.invalid';
const STARTUP_TIMEOUT_MS = 20_000;
const STARTUP_READ_TIMEOUT_MS = 1_000;
const CDP_REQUEST_TIMEOUT_MS = 10_000;
const MOBILE_SHEET_SCREENSHOT = 'article-navigation-mobile-sheet.png';

const viewports = [
  { name: 'wide', width: 1440, height: 900, screenshot: 'article-navigation-wide.png' },
  { name: 'laptop', width: 1280, height: 800, screenshot: 'article-navigation-laptop.png' },
  { name: 'mobile', width: 390, height: 844, screenshot: 'article-navigation-mobile.png' },
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function listenOnLoopback(server, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} did not bind to ${HOST} within ${STARTUP_TIMEOUT_MS}ms`));
    }, STARTUP_TIMEOUT_MS);
    const finish = (error) => {
      clearTimeout(timeout);
      server.removeListener('error', finish);
      if (error) {
        reject(error);
        return;
      }
      const address = server.address();
      if (!address || typeof address === 'string' || address.address !== HOST) {
        reject(new Error(`${label} did not bind to the required loopback address`));
        return;
      }
      resolve(address.port);
    };
    server.once('error', finish);
    server.listen(0, HOST, () => finish());
  });
}

function createDenyProxy() {
  const sockets = new Set();
  const proxy = {
    server: null,
    sockets,
    port: null,
    canaryConnects: 0,
    rejectedCanaryConnects: 0,
    unexpectedRequests: [],
  };
  const server = createNetServer((socket) => {
    sockets.add(socket);
    socket.setTimeout(1_000, () => socket.destroy());
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', () => {});

    let request = '';
    socket.on('data', (chunk) => {
      request += chunk.toString('latin1');
      if (request.length > 8_192) {
        proxy.unexpectedRequests.push('oversized proxy request');
        socket.destroy();
        return;
      }
      if (!request.includes('\r\n\r\n')) return;

      socket.removeAllListeners('data');
      const requestLine = request.slice(0, request.indexOf('\r\n'));
      const match = /^CONNECT ([^ ]+) HTTP\/1\.[01]$/.exec(requestLine);
      const target = match?.[1];
      const isCanary = target === `${WSS_CANARY_HOST}:443`;
      if (isCanary) {
        proxy.canaryConnects += 1;
      } else {
        proxy.unexpectedRequests.push(requestLine);
      }
      socket.end(
        'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
        () => {
          if (isCanary) proxy.rejectedCanaryConnects += 1;
        },
      );
    });
  });
  proxy.server = server;
  return proxy;
}

async function closeProbeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.closeAllConnections?.();
      reject(new Error('Vite HTTP server did not close within 3000ms'));
    }, 3_000);
    server.close((error) => {
      clearTimeout(timeout);
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolve();
    });
  });
}

async function closeDenyProxy(proxy) {
  if (!proxy) return;
  for (const socket of proxy.sockets) socket.destroy();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Deny proxy did not close within 3000ms')), 3_000);
    proxy.server.close((error) => {
      clearTimeout(timeout);
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolve();
    });
  });
}

async function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/opt/google/chrome/chrome',
    path.join(process.env.HOME ?? '', '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue to the next known local executable.
    }
  }

  throw new Error('No local Chromium or Chrome executable was found. Set CHROME_PATH to one.');
}

function spawnTracked(command, args) {
  const output = [];
  const collect = (chunk) => {
    output.push(String(chunk));
    if (output.length > 80) output.shift();
  };
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.spawnError = null;
  child.once('error', (error) => {
    child.spawnError = error;
    collect(`Chrome spawn failed: ${error.message}`);
  });
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.collectedOutput = () => output.join('').trim();
  return child;
}

async function terminateTracked(child) {
  if (!child || !child.pid || child.spawnError || child.exitCode !== null || child.signalCode !== null) return;

  const waitForExit = (timeoutMs) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    let timer;
    const handleExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    timer = setTimeout(() => {
      child.removeListener('exit', handleExit);
      resolve(false);
    }, timeoutMs);
    child.once('exit', handleExit);
    if (child.exitCode !== null || child.signalCode !== null) handleExit();
  });

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    return;
  }

  if (await waitForExit(3_000)) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  if (!(await waitForExit(3_000))) {
    throw new Error(`Process group ${child.pid} did not exit after SIGKILL`);
  }
}

async function waitForLocalJson(url, child, label) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    throwIfInterrupted();
    if (child.spawnError) {
      throw new Error(`${label} failed to spawn.\n${child.collectedOutput()}`);
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} exited during startup.\n${child.collectedOutput()}`);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(
        STARTUP_READ_TIMEOUT_MS,
        Math.max(1, deadline - Date.now()),
      ));
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) return await response.json();
        lastError = new Error(`${response.status} ${response.statusText}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(`${label} did not become ready: ${lastError?.message ?? 'timeout'}\n${child.collectedOutput()}`);
}

async function waitForDevToolsEndpoint(profileDirectory, child) {
  const endpointFile = path.join(profileDirectory, 'DevToolsActivePort');
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    throwIfInterrupted();
    if (child.spawnError) {
      throw new Error(`Chrome failed to spawn.\n${child.collectedOutput()}`);
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Chrome exited during startup.\n${child.collectedOutput()}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(
      STARTUP_READ_TIMEOUT_MS,
      Math.max(1, deadline - Date.now()),
    ));
    try {
      const contents = await readFile(endpointFile, { encoding: 'utf8', signal: controller.signal });
      const [portLine, browserPath] = contents.trim().split(/\r?\n/);
      const port = Number.parseInt(portLine, 10);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error(`invalid Chrome port ${JSON.stringify(portLine)}`);
      }
      if (!/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(browserPath ?? '')) {
        throw new Error(`invalid Chrome browser endpoint ${JSON.stringify(browserPath)}`);
      }
      return { port, browserPath };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    await delay(50);
  }

  throw new Error(`Chrome did not publish DevToolsActivePort: ${lastError?.message ?? 'timeout'}`);
}

const resources = {
  vite: null,
  httpServer: null,
  denyProxy: null,
  chrome: null,
  client: null,
  profileDirectory: null,
  artifactsDirectory: null,
  preserveArtifacts: false,
};
let cleanupPromise = null;
let receivedSignal = null;
let signalCleanupKeepAlive = null;

const hasResources = () => Boolean(
  resources.vite
  || resources.httpServer
  || resources.denyProxy
  || resources.chrome
  || resources.client
  || resources.profileDirectory
  || resources.artifactsDirectory,
);

async function cleanupResources() {
  if (cleanupPromise) return cleanupPromise;

  const cleanupRun = (async () => {
    const client = resources.client;
    const chrome = resources.chrome;
    const vite = resources.vite;
    const httpServer = resources.httpServer;
    const denyProxy = resources.denyProxy;
    const profileDirectory = resources.profileDirectory;
    const artifactsDirectory = resources.artifactsDirectory;
    const preserveArtifacts = resources.preserveArtifacts;
    resources.client = null;
    resources.chrome = null;
    resources.vite = null;
    resources.httpServer = null;
    resources.denyProxy = null;
    resources.profileDirectory = null;
    resources.artifactsDirectory = null;
    resources.preserveArtifacts = false;

    try {
      client?.close();
    } catch {
      // Continue cleanup if the debugger socket already closed.
    }

    const cleanupResults = await Promise.allSettled([
      terminateTracked(chrome),
      closeProbeServer(httpServer),
      closeDenyProxy(denyProxy),
      vite?.close(),
    ]);
    let directoryCleanupError;
    if (profileDirectory) {
      try {
        await rm(profileDirectory, { recursive: true, force: true });
      } catch (error) {
        directoryCleanupError = error;
      }
    }
    if (artifactsDirectory && !preserveArtifacts) {
      try {
        await rm(artifactsDirectory, { recursive: true, force: true });
      } catch (error) {
        directoryCleanupError ??= error;
      }
    }

    const processCleanupError = cleanupResults.find(({ status }) => status === 'rejected');
    if (processCleanupError?.status === 'rejected') throw processCleanupError.reason;
    if (directoryCleanupError) throw directoryCleanupError;
  })();

  cleanupPromise = cleanupRun;
  try {
    await cleanupRun;
  } finally {
    if (cleanupPromise === cleanupRun) cleanupPromise = null;
  }
}

const signalExitCode = (signal) => (signal === 'SIGINT' ? 130 : 143);

const handleSignal = (signal) => {
  if (receivedSignal) return;
  receivedSignal = signal;
  process.exitCode = signalExitCode(signal);
  signalCleanupKeepAlive = setInterval(() => {}, 1_000);
  cleanupResources()
    .catch((error) => {
      console.error(`Cleanup after ${signal} failed:`, error);
    });
};

const handleSigint = () => handleSignal('SIGINT');
const handleSigterm = () => handleSignal('SIGTERM');

const throwIfInterrupted = () => {
  if (receivedSignal) throw new Error(`Interrupted by ${receivedSignal}`);
};

process.on('SIGINT', handleSigint);
process.on('SIGTERM', handleSigterm);

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Chrome CDP connection timed out after ${CDP_REQUEST_TIMEOUT_MS}ms`));
      }, CDP_REQUEST_TIMEOUT_MS);
      const settle = (callback) => (value) => {
        clearTimeout(timeout);
        callback(value);
      };
      this.webSocket.addEventListener('open', settle(resolve), { once: true });
      this.webSocket.addEventListener(
        'error',
        settle(() => reject(new Error('Could not connect to Chrome CDP'))),
        { once: true },
      );
      this.webSocket.addEventListener(
        'close',
        settle(() => reject(new Error('Chrome CDP closed before connecting'))),
        { once: true },
      );
    });

    const rejectPending = () => {
      for (const { reject, timeout } of this.pending.values()) {
        clearTimeout(timeout);
        reject(new Error('Chrome CDP disconnected'));
      }
      this.pending.clear();
    };
    this.webSocket.addEventListener('close', rejectPending);
    this.webSocket.addEventListener('error', rejectPending);

    this.webSocket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timeout);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }

      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  async send(method, params = {}, timeoutMs = CDP_REQUEST_TIMEOUT_MS) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`Chrome CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.webSocket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close() {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(new Error('Chrome CDP client closed'));
    }
    this.pending.clear();
    this.webSocket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(client, expression, description, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function navigate(client, url) {
  await client.send('Page.navigate', { url });
  await waitFor(client, 'document.readyState === "complete"', 'document load');
  await waitFor(client, 'Boolean(document.querySelector("h1"))', 'the article application to render');
  await delay(250);
}

const isVisibleExpression = (selector) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
})()`;

async function captureScreenshot(client, filePath) {
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(filePath, Buffer.from(data, 'base64'), { flag: 'wx' });
}

async function runChecks(client, runtimeExceptions, artifactsDirectory, vitePort, denyProxy = null) {
  let assertionCount = 0;
  const failures = [];
  const check = (condition, message) => {
    assertionCount += 1;
    if (!condition) failures.push(message);
  };

  const { arguments: browserArguments = [] } = await client.send('Browser.getBrowserCommandLine');
  check(
    denyProxy
      && browserArguments.includes(`--proxy-server=http://${HOST}:${denyProxy.port}`),
    'browser: controlled outbound deny proxy is missing',
  );
  check(
    browserArguments.some((argument) => argument.startsWith('--host-resolver-rules=')),
    'browser: outbound DNS isolation is missing',
  );
  check(
    browserArguments.includes('--proxy-bypass-list=localhost;127.0.0.1'),
    'browser: outbound proxy bypass is not limited to probe localhost origins',
  );
  const websocketIsolation = await evaluate(client, `new Promise((resolve) => {
    const socket = new WebSocket('wss://${WSS_CANARY_HOST}/article-navigation-probe');
    const timeout = setTimeout(() => {
      socket.close();
      resolve('timeout');
    }, 1500);
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      socket.close();
      resolve('connected');
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve('blocked');
    }, { once: true });
  })`);
  check(
    websocketIsolation === 'blocked'
      && denyProxy?.canaryConnects === 1
      && denyProxy?.rejectedCanaryConnects === 1,
    `browser: WSS canary did not fail closed through the deny proxy (${websocketIsolation})`,
  );

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 420,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate(client, `http://${HOST}:${vitePort}${ARTICLE_PATH}?layout-probe=reveal-once`);
  await evaluate(client, 'document.querySelector("[data-series-trigger]").click()');
  await waitFor(client, 'Boolean(document.querySelector("[role=dialog]"))', 'reveal-once dialog to open');
  await evaluate(client, `(() => {
    const toggles = document.querySelectorAll('[role="dialog"] .series-navigation__group-toggle');
    toggles[toggles.length - 1].click();
  })()`);
  await delay(100);
  await evaluate(client, `(() => {
    const body = document.querySelector('[role="dialog"] .navigation-sheet__body');
    body.scrollTop = 0;
    const toggles = body.querySelectorAll('.series-navigation__group-toggle');
    toggles[toggles.length - 1].click();
  })()`);
  await delay(100);
  check(
    (await evaluate(client, 'document.querySelector("[role=dialog] .navigation-sheet__body").scrollTop')) <= 1,
    'mobile: changing group expansion pulled the sheet back to the current chapter',
  );
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await waitFor(client, '!document.querySelector("[role=dialog]")', 'reveal-once dialog to close');

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 600,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate(client, `http://${HOST}:${vitePort}${LONG_SERIES_PATH}?layout-probe=long-series`);
  await evaluate(client, 'document.querySelector("[data-series-trigger]").click()');
  await waitFor(client, 'Boolean(document.querySelector("[role=dialog]"))', 'long series dialog to open');
  const directLoadedCurrentVisible = `(() => {
    const body = document.querySelector('[role="dialog"] .navigation-sheet__body');
    const current = body?.querySelector('[aria-current="page"]');
    if (!body || !current) return false;
    const bodyRect = body.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    return currentRect.top >= bodyRect.top - 1 && currentRect.bottom <= bodyRect.bottom + 1;
  })()`;
  await waitFor(
    client,
    directLoadedCurrentVisible,
    'the direct-loaded current chapter to enter the sheet viewport',
  );
  check(
    await evaluate(client, directLoadedCurrentVisible),
    'mobile: direct-loaded late chapter is outside the sheet viewport',
  );
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await waitFor(client, '!document.querySelector("[role=dialog]")', 'long series dialog to close');

  for (const viewport of viewports) {
    const viewportUrl = `http://${HOST}:${vitePort}${ARTICLE_PATH}?layout-probe=${viewport.name}`;
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width < 500,
    });
    await navigate(client, viewportUrl);

    check(
      await evaluate(client, 'document.documentElement.scrollWidth <= document.documentElement.clientWidth'),
      `${viewport.name}: document has horizontal overflow`,
    );
    check(
      await evaluate(client, 'Boolean(document.querySelector("[data-article-surface]"))'),
      `${viewport.name}: [data-article-surface] is missing`,
    );
    if (viewport.name === 'wide' || viewport.name === 'laptop') {
      check(
        await evaluate(client, `(() => {
          const panel = document.querySelector('[data-series-sidebar] .article-rail__panel');
          const reserve = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--mini-player-reserve')
          ) || 0;
          return panel.getBoundingClientRect().bottom <= window.innerHeight - reserve - 16 + 1;
        })()`),
        `${viewport.name}: series rail intrudes into the mini-player clearance`,
      );
    }

    if (viewport.name === 'wide') {
      check(await evaluate(client, isVisibleExpression('[data-series-sidebar]')), 'wide: series rail is not visible');
      check(await evaluate(client, isVisibleExpression('[data-page-outline]')), 'wide: page outline is not visible');
      const railHeightLimits = await evaluate(client, `(() => (
        [
          ['series', document.querySelector('[data-series-sidebar]')],
          ['outline', document.querySelector('[data-page-outline]')],
        ].map(([name, rail]) => {
          const panel = rail.querySelector('.article-rail__panel');
          const reserve = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--mini-player-reserve')
          ) || 0;
          return {
            name,
            maxHeight: Number.parseFloat(getComputedStyle(panel).maxHeight),
            available: window.innerHeight - rail.getBoundingClientRect().top - reserve - 16,
          };
        })
      ))()`);
      for (const { name, maxHeight, available } of railHeightLimits) {
        check(
          maxHeight <= available + 1,
          `wide: ${name} rail max-height ${maxHeight}px exceeds current allowance ${available}px`,
        );
      }
      check(
        (await evaluate(client, 'document.querySelectorAll("[data-series-sidebar] [aria-current=\\"page\\"]").length')) === 1,
        'wide: expected exactly one current series chapter',
      );
      const geometry = await evaluate(client, `(() => {
        const series = document.querySelector('[data-series-sidebar]').getBoundingClientRect();
        const article = document.querySelector('[data-article-surface]').getBoundingClientRect();
        const outline = document.querySelector('[data-page-outline]').getBoundingClientRect();
        return { seriesRight: series.right, articleLeft: article.left, articleRight: article.right, outlineLeft: outline.left };
      })()`);
      check(geometry.seriesRight <= geometry.articleLeft, 'wide: series rail overlaps the article');
      check(geometry.articleRight <= geometry.outlineLeft, 'wide: page outline overlaps the article');

      const collapsedPlayer = await evaluate(client, `(() => {
        const player = document.querySelector('[aria-label="音乐播放器"]');
        const reserve = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--mini-player-reserve')
        ) || 0;
        return { height: player.getBoundingClientRect().height, reserve };
      })()`);
      check(
        Math.abs(collapsedPlayer.reserve - collapsedPlayer.height) <= 1,
        `wide: collapsed player reserve ${collapsedPlayer.reserve}px does not match its ${collapsedPlayer.height}px height`,
      );
      await evaluate(client, 'document.querySelector(\'[aria-label="展开播放器"]\').click()');
      await delay(350);
      const expandedPlayer = await evaluate(client, `(() => {
        const player = document.querySelector('[aria-label="音乐播放器"]');
        const reserve = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--mini-player-reserve')
        ) || 0;
        const playerRect = player.getBoundingClientRect();
        const rails = [...document.querySelectorAll('[data-series-sidebar], [data-page-outline]')]
          .filter((rail) => getComputedStyle(rail).display !== 'none')
          .map((rail) => {
            const panel = rail.querySelector('.article-rail__panel');
            return {
              maxHeight: Number.parseFloat(getComputedStyle(panel).maxHeight),
              allowed: innerHeight - rail.getBoundingClientRect().top - reserve - 16,
              bottom: panel.getBoundingClientRect().bottom,
            };
          });
        return { height: playerRect.height, reserve, top: playerRect.top, rails };
      })()`);
      check(
        expandedPlayer.height > collapsedPlayer.height + 20,
        'wide: expanding the real mini player did not increase its rendered height',
      );
      check(
        Math.abs(expandedPlayer.reserve - expandedPlayer.height) <= 1,
        `wide: expanded player reserve ${expandedPlayer.reserve}px does not match its ${expandedPlayer.height}px height`,
      );
      for (const rail of expandedPlayer.rails) {
        check(rail.maxHeight <= rail.allowed + 1, 'wide: a rail did not resize for the expanded mini player');
        check(rail.bottom <= expandedPlayer.top + 1, 'wide: expanded mini player covers rail content');
      }
      await evaluate(client, 'document.querySelector(\'[aria-label="收起播放器"]\').click()');
      await delay(350);
      const collapsedAgain = await evaluate(client, `(() => {
        const player = document.querySelector('[aria-label="音乐播放器"]');
        return {
          height: player.getBoundingClientRect().height,
          reserve: Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--mini-player-reserve')
          ) || 0,
        };
      })()`);
      check(
        Math.abs(collapsedAgain.reserve - collapsedAgain.height) <= 1,
        'wide: collapsing the mini player did not restore its measured reserve',
      );

      const persistenceProbe = await evaluate(client, `(() => {
        const scroller = document.querySelector('[data-series-sidebar] .series-navigation');
        const scrollRange = scroller.scrollHeight - scroller.clientHeight;
        if (scrollRange <= 1) return { tested: false };
        scroller.scrollTop = scrollRange;
        scroller.dispatchEvent(new Event('scroll'));
        const bounds = scroller.getBoundingClientRect();
        const sibling = [...scroller.querySelectorAll('a[href]:not([aria-current="page"])')]
          .reverse()
          .find((link) => {
            const rect = link.getBoundingClientRect();
            return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
          });
        return sibling
          ? { tested: true, href: sibling.href, scrollTop: scroller.scrollTop }
          : { tested: false };
      })()`);
      if (persistenceProbe.tested) {
        await delay(50);
        await navigate(client, persistenceProbe.href);
        const restoredScroll = await evaluate(
          client,
          'document.querySelector("[data-series-sidebar] .series-navigation").scrollTop',
        );
        check(
          Math.abs(restoredScroll - persistenceProbe.scrollTop) <= 1,
          `wide: series scroll was not restored across a sibling route (${persistenceProbe.scrollTop}px to ${restoredScroll}px)`,
        );
        await navigate(client, viewportUrl);
      }
    }

    if (viewport.name === 'laptop') {
      check(await evaluate(client, isVisibleExpression('[data-series-sidebar]')), 'laptop: series rail is not visible');
      check(!(await evaluate(client, isVisibleExpression('[data-page-outline]'))), 'laptop: page outline should be hidden');
      check(await evaluate(client, isVisibleExpression('[data-outline-trigger]')), 'laptop: outline trigger is not visible');
    }

    if (viewport.name === 'mobile') {
      check(!(await evaluate(client, isVisibleExpression('[data-series-sidebar]'))), 'mobile: series rail should be hidden');
      check(!(await evaluate(client, isVisibleExpression('[data-page-outline]'))), 'mobile: page outline should be hidden');
      check(await evaluate(client, isVisibleExpression('[data-series-trigger]')), 'mobile: series trigger is not visible');
      check(await evaluate(client, isVisibleExpression('[data-outline-trigger]')), 'mobile: outline trigger is not visible');

      const sheetScrollPosition = await evaluate(client, 'window.scrollY');
      await evaluate(client, 'document.querySelector("[data-series-trigger]").click()');
      await waitFor(client, 'Boolean(document.querySelector("[role=dialog]"))', 'series dialog to open');
      await delay(250);
      const sheetGeometry = await evaluate(client, `(() => {
        const backdrop = document.querySelector('.navigation-sheet-backdrop');
        const panel = document.querySelector('[role="dialog"]');
        const body = panel.querySelector('.navigation-sheet__body');
        const current = panel.querySelector('[aria-current="page"]');
        const panelRect = panel.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const currentRect = current.getBoundingClientRect();
        const player = document.querySelector('[aria-label="音乐播放器"]');
        return {
          panelTop: panelRect.top,
          panelBottom: panelRect.bottom,
          panelMaxHeight: getComputedStyle(panel).maxHeight,
          bodyOverflow: getComputedStyle(body).overflowY,
          currentTop: currentRect.top,
          currentBottom: currentRect.bottom,
          bodyTop: bodyRect.top,
          bodyBottom: bodyRect.bottom,
          backdropZ: Number.parseInt(getComputedStyle(backdrop).zIndex, 10),
          playerZ: Number.parseInt(getComputedStyle(player).zIndex, 10),
        };
      })()`);
      check(sheetGeometry.panelTop >= viewport.height * 0.15, 'mobile: navigation is still a full-height drawer');
      check(
        Math.abs(sheetGeometry.panelBottom - viewport.height) <= 1,
        'mobile: navigation sheet is not bottom anchored',
      );
      check(sheetGeometry.panelMaxHeight !== 'none', 'mobile: navigation sheet has no max-height');
      check(sheetGeometry.bodyOverflow === 'auto', 'mobile: navigation sheet body is not internally scrollable');
      check(
        sheetGeometry.currentTop >= sheetGeometry.bodyTop - 1
          && sheetGeometry.currentBottom <= sheetGeometry.bodyBottom + 1,
        'mobile: current series chapter is outside the sheet viewport',
      );
      check(
        sheetGeometry.backdropZ > sheetGeometry.playerZ,
        'mobile: mini player can cover navigation sheet controls',
      );
      await captureScreenshot(client, path.join(artifactsDirectory, MOBILE_SHEET_SCREENSHOT));
      check(
        (await evaluate(client, 'window.scrollY')) === sheetScrollPosition,
        'mobile: opening the series sheet changed document scroll',
      );
      check(
        await evaluate(client, `(() => {
          const dialog = document.querySelector('[role=dialog]');
          const label = dialog?.getAttribute('aria-labelledby');
          return dialog?.getAttribute('aria-modal') === 'true' && label && document.getElementById(label)?.textContent.trim() === '系列章节';
        })()`),
        'mobile: series sheet is not a modal dialog named 系列章节',
      );
      check(
        await evaluate(client, 'getComputedStyle(document.body).overflow === "hidden"'),
        'mobile: opening the series sheet did not lock body scrolling',
      );
      check(
        (await evaluate(client, 'document.querySelectorAll("[role=dialog] [aria-current=\\"page\\"]").length')) === 1,
        'mobile: series sheet does not contain exactly one current chapter',
      );
      await waitFor(
        client,
        'document.activeElement === document.querySelector(".navigation-sheet__close")',
        'series dialog initial focus',
      );
      check(
        await evaluate(client, 'document.activeElement === document.querySelector(".navigation-sheet__close")'),
        'mobile: series sheet did not focus its close control',
      );

      await client.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8,
      });
      await client.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8,
      });
      check(
        await evaluate(client, `(() => {
          const dialog = document.querySelector('[role=dialog]');
          return dialog.contains(document.activeElement)
            && document.activeElement !== document.querySelector('.navigation-sheet__close');
        })()`),
        'mobile: Shift+Tab did not wrap to the last dialog control',
      );
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
      check(
        await evaluate(client, 'document.activeElement === document.querySelector(".navigation-sheet__close")'),
        'mobile: Tab did not wrap to the first dialog control',
      );

      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
      await waitFor(client, '!document.querySelector("[role=dialog]")', 'series dialog to close');
      check(
        (await evaluate(client, 'window.scrollY')) === sheetScrollPosition,
        'mobile: closing the series sheet changed document scroll',
      );
      check(
        await evaluate(client, 'getComputedStyle(document.body).overflow !== "hidden"'),
        'mobile: closing the series sheet did not unlock body scrolling',
      );
      check(
        await evaluate(client, 'document.activeElement === document.querySelector("[data-series-trigger]")'),
        'mobile: series trigger focus was not restored',
      );

      await evaluate(client, 'document.querySelector("[data-series-trigger]").click()');
      await waitFor(client, 'Boolean(document.querySelector("[role=dialog]"))', 'series dialog to reopen');
      await evaluate(client, `document.querySelector('.navigation-sheet-backdrop').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true })
      )`);
      await waitFor(client, '!document.querySelector("[role=dialog]")', 'backdrop click to close the series dialog');
      check(
        await evaluate(client, 'getComputedStyle(document.body).overflow !== "hidden"'),
        'mobile: backdrop dismissal did not unlock body scrolling',
      );

      await evaluate(client, 'document.querySelector("[data-outline-trigger]").click()');
      await waitFor(client, 'Boolean(document.querySelector("[role=dialog]"))', 'outline dialog to open');
      await evaluate(client, 'document.querySelector("[role=dialog] .page-outline__link").click()');
      await waitFor(client, '!document.querySelector("[role=dialog]")', 'outline selection to close the dialog');
      await waitFor(client, 'window.scrollY > 100', 'outline selection to scroll to its heading');
      check(
        await evaluate(client, 'window.scrollY > 100'),
        'mobile: outline selection did not scroll to its heading',
      );
      await navigate(client, `${viewportUrl}&capture=1`);
    }

    await captureScreenshot(client, path.join(artifactsDirectory, viewport.screenshot));
  }

  check(runtimeExceptions.length === 0, `uncaught runtime exceptions:\n${runtimeExceptions.join('\n')}`);
  assert.deepEqual(failures, [], `article navigation failures:\n${failures.join('\n')}`);
  return assertionCount;
}

async function main() {
  const chromeExecutable = await resolveChrome();
  resources.profileDirectory = await mkdtemp(path.join(tmpdir(), 'article-navigation-chrome-'));
  resources.artifactsDirectory = await mkdtemp(path.join(tmpdir(), 'article-navigation-artifacts-'));
  resources.denyProxy = createDenyProxy();
  resources.denyProxy.port = await listenOnLoopback(resources.denyProxy.server, 'Deny proxy');
  throwIfInterrupted();

  resources.vite = await createViteServer({
    root: process.cwd(),
    logLevel: 'silent',
    server: {
      middlewareMode: true,
      hmr: false,
      fs: {
        allow: [process.cwd(), await realpath('node_modules')],
      },
    },
  });
  throwIfInterrupted();
  resources.httpServer = createHttpServer(resources.vite.middlewares);
  const vitePort = await listenOnLoopback(resources.httpServer, 'Vite HTTP server');
  throwIfInterrupted();

  resources.chrome = spawnTracked(chromeExecutable, [
    '--headless=new',
    '--no-sandbox',
    `--remote-debugging-address=${HOST}`,
    '--remote-debugging-port=0',
    `--user-data-dir=${resources.profileDirectory}`,
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-features=AutofillServerCommunication,MediaRouter,OptimizationHints,Translate',
    '--disable-sync',
    '--enable-automation',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    '--metrics-recording-only',
    '--no-default-browser-check',
    '--no-first-run',
    '--password-store=basic',
    '--proxy-bypass-list=localhost;127.0.0.1',
    `--proxy-server=http://${HOST}:${resources.denyProxy.port}`,
    '--use-mock-keychain',
    'about:blank',
  ]);

  const devToolsEndpoint = await waitForDevToolsEndpoint(resources.profileDirectory, resources.chrome);
  const chromeOrigin = `http://${HOST}:${devToolsEndpoint.port}`;
  const version = await waitForLocalJson(`${chromeOrigin}/json/version`, resources.chrome, 'Chrome');
  const browserWebSocket = new URL(version.webSocketDebuggerUrl);
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(browserWebSocket.hostname)
      && Number.parseInt(browserWebSocket.port, 10) === devToolsEndpoint.port
      && browserWebSocket.pathname === devToolsEndpoint.browserPath,
    'Chrome browser endpoint does not belong to the private DevToolsActivePort profile',
  );
  const targets = await waitForLocalJson(`${chromeOrigin}/json/list`, resources.chrome, 'Chrome');
  throwIfInterrupted();
  const pageTarget = targets.find((target) => target.type === 'page');
  assert.ok(pageTarget?.webSocketDebuggerUrl, 'Chrome did not expose a page target');
  const pageWebSocket = new URL(pageTarget.webSocketDebuggerUrl);
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(pageWebSocket.hostname)
      && Number.parseInt(pageWebSocket.port, 10) === devToolsEndpoint.port,
    'Chrome page endpoint does not belong to the private DevToolsActivePort profile',
  );

  resources.client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  const runtimeExceptions = [];
  const blockedOutboundRequests = [];
  const fontLoadFailures = [];
  resources.client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    runtimeExceptions.push(
      exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'Unknown runtime exception',
    );
  });
  resources.client.on('Fetch.requestPaused', ({ requestId, request }) => {
    const requestUrl = new URL(request.url);
    const localOrigin = requestUrl.protocol === 'http:'
      && requestUrl.hostname === HOST
      && requestUrl.port === String(vitePort);
    if (localOrigin) {
      resources.client?.send('Fetch.continueRequest', { requestId }).catch(() => {});
    } else {
      blockedOutboundRequests.push(request.url);
      resources.client?.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    }
  });
  resources.client.on('Network.responseReceived', ({ response, type }) => {
    if (type === 'Font' && response.status >= 400) {
      fontLoadFailures.push(`${response.status} ${response.url}`);
    }
  });
  resources.client.on('Network.loadingFailed', ({ errorText, type }) => {
    if (type === 'Font') fontLoadFailures.push(errorText);
  });
  await resources.client.send('Page.enable');
  await resources.client.send('Runtime.enable');
  await resources.client.send('Network.enable');
  await resources.client.send('Fetch.enable', {
    patterns: [
      { urlPattern: 'http://*', requestStage: 'Request' },
      { urlPattern: 'https://*', requestStage: 'Request' },
    ],
  });

  const assertionCount = await runChecks(
    resources.client,
    runtimeExceptions,
    resources.artifactsDirectory,
    vitePort,
    resources.denyProxy,
  );
  assert.deepEqual(fontLoadFailures, [], `font requests failed:\n${fontLoadFailures.join('\n')}`);
  resources.preserveArtifacts = true;
  console.log(`Article navigation check passed: ${assertionCount} assertions across ${viewports.length} viewports.`);
  console.log('Screenshots retained for inspection:');
  for (const viewport of viewports) {
    console.log(path.join(resources.artifactsDirectory, viewport.screenshot));
  }
  console.log(path.join(resources.artifactsDirectory, MOBILE_SHEET_SCREENSHOT));
  console.log(
    `Deny proxy rejected ${resources.denyProxy.rejectedCanaryConnects} controlled WSS CONNECT request(s) on ${HOST}:${resources.denyProxy.port}.`,
  );
  if (blockedOutboundRequests.length) {
    console.log(`Blocked ${blockedOutboundRequests.length} outbound browser request(s).`);
  }
}

async function run() {
  let runError;
  try {
    await main();
  } catch (error) {
    runError = error;
  }

  do {
    try {
      await cleanupResources();
    } catch (error) {
      runError ??= error;
    }
  } while (hasResources());

  process.removeListener('SIGINT', handleSigint);
  process.removeListener('SIGTERM', handleSigterm);
  clearInterval(signalCleanupKeepAlive);
  signalCleanupKeepAlive = null;
  if (runError) throw runError;
}

run().catch((error) => {
  if (!receivedSignal) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
});
