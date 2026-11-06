/**
 * Dev-only: when KAVACH_DEV_PROXY=1 (sandboxed dev environments that only
 * allow HTTPS CONNECT tunnels), route the 0G SDK's axios through the proxy.
 * Never enabled on Vercel.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.KAVACH_DEV_PROXY === "1") {
    const { installSandboxProxy } = await import("../scripts/sandbox-proxy");
    installSandboxProxy();
  }
}
