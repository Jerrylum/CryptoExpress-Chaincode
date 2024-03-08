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
  next: Transport | undefined;
}

export interface Transport {
  courier: string; // Hash ID
  info: string;
  destination: Stop;
}

export interface CommitDetail {
  delta: { [goodUuid: string]: number };
  info: string;
  timestamp: number;
}

export interface Commit {
  detail: CommitDetail;
  signature: BufferObject;
}

/**
 * Represents a point to point segment, a part of a route.
 */
export interface Segment {
  srcOutgoing: Commit | undefined;
  courierReceiving: Commit | undefined;
  courierDelivering: Commit | undefined;
  dstIncoming: Commit | undefined;
}

export interface Route {
  uuid: string;
  goods: { [goodUuid: string]: number };
  addresses: { [addressHashId: string]: Address };
  couriers: { [courierHashId: string]: Courier };
  source: Stop;
  commits: Segment[];
}

export interface RouteProposal {
  route: Route,
  signatures: { [partyHashId: string]: BufferObject };
}
