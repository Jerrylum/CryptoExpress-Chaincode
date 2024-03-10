import { Serializer } from "./lib/fabric-shim-internal";

export class SimpleJSONSerializer implements Serializer {
  toBuffer(result: undefined): undefined;
  toBuffer(result: {} | null): Buffer;
  toBuffer(result: any): Buffer | undefined;
  toBuffer(result: any): Buffer | undefined {
    return SimpleJSONSerializer.serialize(result);
  }

  fromBuffer(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): { value: any; validateData: any } {
    return { value: SimpleJSONSerializer.deserialize(data), validateData: undefined };
  }

  static serialize(result: undefined): undefined;
  static serialize(result: {} | null): Buffer;
  static serialize(result: any): Buffer | undefined;
  static serialize(result: any): Buffer | undefined {
    return result !== undefined ? Buffer.from(JSON.stringify(result)) : undefined;
  }

  static deserialize<T>(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): T {
    return JSON.parse(Buffer.from(data).toString("utf8"));
  }
}
