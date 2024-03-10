import { expect } from "chai";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";

describe("Test SimpleJSONSerializer", async () => {
  it("should serialize/deserialize everything", async () => {
    const serializer = new SimpleJSONSerializer();

    const everything = [
      "string",
      123,
      123.456,
      true,
      false,
      null,
      undefined,
      { prop: "value" },
      ["array"],
      { nested: { prop: "value" } }
    ];

    for (const thing of everything) {
      const buffer = serializer.toBuffer(thing);
      if (buffer === undefined) {
        expect(thing).to.be.undefined;
      } else {
        const result = serializer.fromBuffer(buffer);

        expect(result.value).to.deep.equal(thing);
      }
    }
  });

  it("should serialize/deserialize NaN", async () => {
    const serializer = new SimpleJSONSerializer();

    const buffer = serializer.toBuffer(NaN);
    const result = serializer.fromBuffer(buffer!);

    expect(result.value).to.deep.equal(null);
  });
});
