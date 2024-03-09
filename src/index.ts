import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import { Serializers } from "./lib/fabric-shim-internal";

export const serializers = {
  transaction: "SimpleJSONSerializer", // Set default serializer for transactions
  serializers: {
    SimpleJSONSerializer: SimpleJSONSerializer
  }
} satisfies Serializers;
