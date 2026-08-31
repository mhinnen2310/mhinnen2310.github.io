import { describe, expect, it } from "vitest";
import { mediaOriginalUrl, mediaWidthUrl } from "./media";

describe("media URL encoding", () => {
  it("keeps storage-key path separators intact", () => {
    expect(mediaWidthUrl("bikes/bike id", 256)).toBe("/api/media/bikes/bike%20id/w-256.webp");
    expect(mediaOriginalUrl("products/product id", "orig.jpg")).toBe(
      "/api/media/products/product%20id/orig.jpg",
    );
  });
});
