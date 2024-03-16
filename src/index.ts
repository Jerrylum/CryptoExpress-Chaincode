import { Contract } from "fabric-contract-api";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import { Serializers } from "./lib/fabric-shim-internal";
import { DeliveryContract } from "./DeliveryContract";

export const serializers = {
  transaction: "SimpleJSONSerializer", // Set default serializer for transactions
  serializers: {
    SimpleJSONSerializer: SimpleJSONSerializer
  }
} satisfies Serializers;

export const contracts: typeof Contract[] = [DeliveryContract];
