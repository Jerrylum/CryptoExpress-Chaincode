import { Serializer } from "./types/fabric-shim-internal";

export class SimpleJSONSerializer implements Serializer {
  toBuffer(result: any): Buffer {
    return Buffer.from(JSON.stringify(result));
  }

  fromBuffer(data: any): { value: any; validateData: any } {
    return { value: JSON.parse(data.toString("utf8")), validateData: undefined };
  }
}
