import { Serializer } from "./types/fabric-shim-internal";

export class SimpleJSONSerializer implements Serializer {
  toBuffer(result: any): Buffer {
    return Buffer.from(JSON.stringify(result));
  }

  fromBuffer(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): { value: any; validateData: any } {
    return { value: JSON.parse(Buffer.from(data).toString("utf8")), validateData: undefined };
  }
}
