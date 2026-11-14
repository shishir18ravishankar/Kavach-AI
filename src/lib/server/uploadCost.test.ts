import { describe, it, expect } from "vitest";
import { classifyUploadError, parseMinPriorityFee, storageFeeWei, to0G, uploadCostWei, UPLOAD_GAS_BUDGET } from "./uploadCost";

const GWEI = 1_000_000_000n;

describe("upload cost model", () => {
  it("parses the node's minimum priority fee", () => {
    expect(parseMinPriorityFee('{"code":-32003,"message":"transaction priority fee below minimum required priority fee 1000000000000"}')).toBe(1000n * GWEI);
    expect(parseMinPriorityFee("insufficient funds")).toBeNull();
  });

  it("classifies the errors seen on the live site", () => {
    expect(classifyUploadError("transaction priority fee below minimum required priority fee 100000000000")).toBe("underpriced");
    expect(classifyUploadError("insufficient funds for gas * price + value")).toBe("funds");
    expect(classifyUploadError('execution reverted (no data present; likely require(false) occurred (action="estimateGas"')).toBe("funds");
    expect(classifyUploadError("nonce too low")).toBe("transient");
    expect(classifyUploadError("something else")).toBe("other");
  });

  it("storage fee is negligible next to gas", () => {
    // 2 KB document: at most 16 sectors × 31 gwei ≈ 0.0000005 0G
    expect(storageFeeWei(2048)).toBe(16n * 31n * GWEI);
    // even at a 1 gwei gas price, gas is >100× the storage fee
    expect(storageFeeWei(2048) * 100n).toBeLessThan(UPLOAD_GAS_BUDGET * GWEI);
  });

  it("matches the measured costs", () => {
    // At the 1,000 gwei floor: 360k gas × 1,000 gwei = 0.36 0G (+ dust)
    expect(to0G(uploadCostWei(1000n * GWEI, 2300))).toBe("0.3600");
    // At the 2,000 gwei RPC suggestion: 0.72 0G
    expect(to0G(uploadCostWei(2000n * GWEI, 2300))).toBe("0.7200");
    // At the hackathon-era 4 gwei: ~0.0014 0G
    expect(to0G(uploadCostWei(4n * GWEI, 2300))).toBe("0.0014");
  });
});
