import { Contract } from "fabric-contract-api";
import { ChaincodeResponse, ChaincodeStub } from "fabric-shim";

declare class ChaincodeFromContract {
  constructor(
    contractClasses: (typeof Contract)[],
    serializers: Serializers,
    metadata?: {},
    title?: string,
    version?: string
  );

  serializers: any;
  title: string;
  version: string;
  contractImplementations: any;
  metadata: any;

  _compileSchemas(): void;
  _dataMarshall(requestedSerializer: any): any;
  _ajv(schemaList: any[]): any;
  _checkAgainstSuppliedMetadata(metadata: any): any[];
  _resolveContractImplementations(contractClasses: Contract[]): any;
  _augmentMetadataFromCode(metadata: any): any;
  _processContractTransactions(contract: any, ignore: string[]): any[];
  _processContractInfo(contract: any): any;
  Init(stub: ChaincodeStub): Promise<ChaincodeResponse>;
  Invoke(stub: ChaincodeStub): Promise<ChaincodeResponse>;
  invokeFunctionality(stub: ChaincodeStub): Promise<ChaincodeResponse>;
  _splitFunctionName(fcn: string): { contractName: string; function: string };
}

interface Serializer {
  toBuffer(result: any, schema?: {}, loggerPrefix?: string): Buffer;

  fromBuffer(buffer: Buffer, schema: {}, loggerPrefix?: string): any;
}

interface Serializers {
  transaction: string;
  serializers: { [key: string]: new () => Serializer };
}
