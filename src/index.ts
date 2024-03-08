import { SimpleJSONSerializer } from "./SimpleJSONSerializer";

export const serializers = {
  transaction: "SimpleJSONSerializer", // Set default serializer for transactions
  serializers: {
    SimpleJSONSerializer: SimpleJSONSerializer
  }
};
