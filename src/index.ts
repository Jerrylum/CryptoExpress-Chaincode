import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import { Serializers } from "./types/fabric-shim-internal";

export const serializers = {
  transaction: "SimpleJSONSerializer", // Set default serializer for transactions
  serializers: {
    SimpleJSONSerializer: SimpleJSONSerializer
  }
} satisfies Serializers;
