export type KeyHexString = string;
export type SignatureHexString = string;

export type ModelPrefix = "rp" | "rt" | "ad" | "cr";

export type ModelTypeMap = {
  rp: RouteProposal;
  rt: Route;
  ad: Address;
  cr: Courier;
};

export type TransportStep = "srcOutgoing" | "courierReceiving" | "courierDelivering" | "dstIncoming";

export interface HashIdObject {
  hashId: string;
}

export interface PublicKeyObject {
  publicKey: KeyHexString;
}

export interface UuidObject {
  uuid: string;
}

export class Address implements HashIdObject, PublicKeyObject {
  hashId!: string; // hash of the remaining fields
  line1!: string;
  line2!: string;
  recipient!: string;
  publicKey!: KeyHexString;
}

export class Courier implements HashIdObject, PublicKeyObject {
  hashId!: string; // hash of the remaining fields
  name!: string;
  company!: string;
  telephone!: string;
  publicKey!: KeyHexString;
}

export class Good implements UuidObject {
  uuid!: string;
  name!: string;
  barcode!: string;
}

export class Stop {
  address!: string; // Hash ID
  expectedArrivalTimestamp!: number;
  input!: { [goodUuid: string]: number };
  output!: { [goodUuid: string]: number };
  next: Transport | undefined;
}

export class Transport {
  courier!: string; // Hash ID
  info!: string;
  destination!: Stop;
}

export class CommitDetail {
  delta!: { [goodUuid: string]: number };
  info!: string;
  timestamp!: number;
}

export class Commit {
  detail!: CommitDetail;
  signature!: SignatureHexString;
}

/**
 * Represents a point to point segment, a part of a route.
 */
export class Segment {
  srcOutgoing: Commit | undefined;
  courierReceiving: Commit | undefined;
  courierDelivering: Commit | undefined;
  dstIncoming: Commit | undefined;
}

export class Route implements UuidObject {
  uuid!: string;
  goods!: { [goodUuid: string]: Good };
  addresses!: { [addressHashId: string]: Address };
  couriers!: { [courierHashId: string]: Courier };
  source!: Stop;
  commits!: Segment[];
}

export class RouteProposal {
  route!: Route;
  signatures!: { [partyHashId: string]: SignatureHexString }; // partyHashId is the hashId of the address.
}
