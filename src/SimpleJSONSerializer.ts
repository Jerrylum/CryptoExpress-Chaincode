import { Serializer } from "./types/fabric-shim-internal";

export class SimpleJSONSerializer implements Serializer {
  toBuffer(result: any): Buffer {
    return SimpleJSONSerializer.serialize(result);
  }

  fromBuffer(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): { value: any; validateData: any } {
    return { value: SimpleJSONSerializer.deserialize(data), validateData: undefined };
  }

  static serialize(result: any): Buffer {
    return Buffer.from(JSON.stringify(result));
  }

  static deserialize<T>(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): T {
    return JSON.parse(Buffer.from(data).toString("utf8"));
  }
}
