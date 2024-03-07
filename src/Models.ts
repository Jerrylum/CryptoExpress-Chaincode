export type BufferObject = { type: "Buffer"; data: Buffer };

export interface Address {
  hashId: string;
  line1: string;
  line2: string;
  recipient: string;
  publicKey: BufferObject;
}

export interface Courier {
  hashId: string;
  name: string;
  company: string;
  telephone: string;
  publicKey: BufferObject;
}

export interface Good {
  uuid: string;
  name: string;
  barcode: string;
}

export interface Stop {
  address: string; // Hash ID
  arrivalDeltaTimestamp: number;
  input: { [goodUuid: string]: number };
  output: { [goodUuid: string]: number };
  next?: Transport;
}

export interface Transport {
  courier: string; // Hash ID
  info: string;
  destination: Stop;
}

export interface Transhipment {
  delta: { [goodUuid: string]: number };
  timestamp: number;
  signature: BufferObject;
}

export interface Route {
  uuid: string;
  goods: Good[];
  source: Stop;
  partySignatures: { [partyHashId: string]: BufferObject };
}

export interface RouteSession {
  uuid: string; // Route UUID
  transhipment: Transhipment[];
}
