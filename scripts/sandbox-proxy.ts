/**
 * Dev-only: inside sandboxes whose egress only allows HTTPS CONNECT tunnels,
 * route axios (used by the 0G SDKs for plain-HTTP storage nodes) through the
 * tunnel. No effect when HTTPS_PROXY is unset (e.g. on Vercel).
 */
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

export function installSandboxProxy(): void {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return;
  const agent = new HttpsProxyAgent(proxy);
  axios.defaults.proxy = false;
  axios.defaults.httpAgent = agent;
  axios.defaults.httpsAgent = agent;
  process.env.NODE_USE_ENV_PROXY = "1";
}
