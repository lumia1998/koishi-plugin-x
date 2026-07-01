var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/request.ts
import { HttpsProxyAgent } from "https-proxy-agent";
import { logger } from "koishi-plugin-chatluna";
import { lookup } from "node:dns/promises";
import {
  ChatLunaError,
  ChatLunaErrorCode
} from "koishi-plugin-chatluna/utils/error";
import { SocksProxyAgent } from "socks-proxy-agent";
import unidci, { Agent, buildConnector, FormData, ProxyAgent } from "undici";
import { WebSocket } from "ws";
import { SocksClient } from "socks";
function createProxyAgentForFetch(init, proxyAddress) {
  if (init.dispatcher || proxyAddress == null) {
    return init;
  }
  let proxyAddressURL;
  try {
    proxyAddressURL = new URL(proxyAddress);
  } catch (e) {
    logger?.error(
      "Unable to parse your proxy address, please check if your proxy address is correct! (e.g., did you add http://)"
    );
    logger?.error(e);
    throw e;
  }
  if (proxyAddress.startsWith("socks")) {
    init.dispatcher = socksDispatcher(proxyAddressURL);
  } else if (proxyAddress.match(/^https?:\/\//)) {
    init.dispatcher = new ProxyAgent({
      uri: proxyAddress
    });
  } else {
    throw new ChatLunaError(
      ChatLunaErrorCode.UNSUPPORTED_PROXY_PROTOCOL,
      new Error("Unsupported proxy protocol")
    );
  }
  return init;
}
__name(createProxyAgentForFetch, "createProxyAgentForFetch");
function createProxyAgent(proxyAddress) {
  if (proxyAddress.match(/^socks/)) {
    return new SocksProxyAgent(proxyAddress);
  } else if (proxyAddress.match(/^https?:\/\//)) {
    return new HttpsProxyAgent(proxyAddress);
  } else {
    throw new ChatLunaError(
      ChatLunaErrorCode.UNSUPPORTED_PROXY_PROTOCOL,
      new Error("Unsupported proxy protocol")
    );
  }
}
__name(createProxyAgent, "createProxyAgent");
var globalProxyAddress = global["globalProxyAddress"];
function setGlobalProxyAddress(address) {
  if (!address?.trim()) {
    logger?.warn("Global proxy address is empty, using no proxy");
    return;
  }
  if (address.match(/^socks/) || address.match(/^https?:\/\//)) {
    globalProxyAddress = address;
    global["globalProxyAddress"] = address;
  } else {
    throw new ChatLunaError(
      ChatLunaErrorCode.UNSUPPORTED_PROXY_PROTOCOL,
      new Error("Unsupported proxy protocol. Try add http:// or socks")
    );
  }
}
__name(setGlobalProxyAddress, "setGlobalProxyAddress");
function chatLunaFetch(info, init, proxyAddress = globalProxyAddress) {
  if (proxyAddress !== "null" && proxyAddress != null && init?.["dispatcher"] == null) {
    init = createProxyAgentForFetch(init || {}, proxyAddress);
  }
  try {
    return unidci.fetch(info, init);
  } catch (e) {
    if (e.cause) {
      logger.error(e.cause);
    }
    throw e;
  }
}
__name(chatLunaFetch, "chatLunaFetch");
function ws(url, options, proxyAddress = globalProxyAddress) {
  if (proxyAddress !== "null" && proxyAddress != null && options?.agent == null) {
    options = options || {};
    options.agent = createProxyAgent(proxyAddress);
  }
  return new WebSocket(url, options);
}
__name(ws, "ws");
function randomUA() {
  const browsers = ["Chrome", "Edg"];
  const browser = browsers[Math.floor(Math.random() * browsers.length)];
  const chromeVersions = [
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
    "100",
    "101",
    "102",
    "103"
  ];
  const edgeVersions = [
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
    "100",
    "101",
    "102",
    "103"
  ];
  const version = browser === "Chrome" ? chromeVersions[Math.floor(Math.random() * chromeVersions.length)] : edgeVersions[Math.floor(Math.random() * edgeVersions.length)];
  const osVersions = ["10.0", "11.0"];
  const osVersion = osVersions[Math.floor(Math.random() * osVersions.length)];
  return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ${browser}/${version}.0.0.0 Safari/537.36`;
}
__name(randomUA, "randomUA");
function parseSocksURL(url) {
  let lookup2 = false;
  let type = 5;
  const host = url.hostname;
  const port = parseInt(url.port, 10) || 1080;
  switch (url.protocol.replace(":", "")) {
    case "socks4":
      lookup2 = true;
      type = 4;
      break;
    // pass through
    case "socks4a":
      type = 4;
      break;
    case "socks5":
      lookup2 = true;
      type = 5;
      break;
    // pass through
    case "socks":
      type = 5;
      break;
    case "socks5h":
      type = 5;
      break;
    default:
      throw new TypeError(
        `A "socks" protocol must be specified! Got: ${String(
          url.protocol
        )}`
      );
  }
  const proxy = {
    host,
    port,
    type
  };
  if (url.username) {
    Object.defineProperty(proxy, "userId", {
      value: decodeURIComponent(url.username),
      enumerable: false
    });
  }
  if (url.password != null) {
    Object.defineProperty(proxy, "password", {
      value: decodeURIComponent(url.password),
      enumerable: false
    });
  }
  return { shouldLookup: lookup2, proxy };
}
__name(parseSocksURL, "parseSocksURL");
function resolvePort(protocol, port) {
  return port ? Number.parseInt(port) : protocol === "http:" ? 80 : 443;
}
__name(resolvePort, "resolvePort");
function socksConnector(url, tlsOpts = {}) {
  const { timeout = 1e4 } = tlsOpts;
  const undiciConnect = buildConnector(tlsOpts);
  return async (options, callback) => {
    let { protocol, hostname, port, httpSocket } = options;
    const { proxy, shouldLookup } = parseSocksURL(url);
    if (shouldLookup) {
      hostname = (await lookup(hostname)).address;
    }
    const destination = {
      host: hostname,
      port: resolvePort(protocol, port)
    };
    const socksOpts = {
      proxy,
      destination,
      command: "connect",
      timeout,
      existing_socket: httpSocket
    };
    try {
      const r = await SocksClient.createConnection(socksOpts);
      httpSocket = r.socket;
    } catch (error) {
      return callback(error, null);
    }
    if (httpSocket && protocol !== "https:") {
      return callback(null, httpSocket.setNoDelay());
    }
    return undiciConnect({ ...options, httpSocket }, callback);
  };
}
__name(socksConnector, "socksConnector");
function socksDispatcher(proxies, options = {}) {
  const { connect, ...rest } = options;
  return new Agent({ ...rest, connect: socksConnector(proxies, connect) });
}
__name(socksDispatcher, "socksDispatcher");
export {
  FormData,
  chatLunaFetch,
  globalProxyAddress,
  randomUA,
  setGlobalProxyAddress,
  socksConnector,
  socksDispatcher,
  ws
};
