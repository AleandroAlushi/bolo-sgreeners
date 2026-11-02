import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FIGURINA, toFigurina } from "../src/lib/figurina";

const blank = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#808080" } }).jpeg().toBuffer();

describe("toFigurina", () => {
  it("ritaglia 4:5 una foto orizzontale", async () => {
    const meta = await sharp(await toFigurina(await blank(3888, 2592))).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([FIGURINA.width, FIGURINA.height, "jpeg"]);
  });

  it("ritaglia 4:5 una foto verticale da telefono", async () => {
    const meta = await sharp(await toFigurina(await blank(3024, 4032))).metadata();
    expect([meta.width, meta.height]).toEqual([FIGURINA.width, FIGURINA.height]);
  });

  it("non ingrandisce le foto piccole ma tiene il 4:5", async () => {
    const meta = await sharp(await toFigurina(await blank(400, 700))).metadata();
    expect([meta.width, meta.height]).toEqual([400, 500]);
  });
});
