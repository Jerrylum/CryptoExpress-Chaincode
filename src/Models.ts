export type KeyHexString = string;
export type SignatureHexString = string;

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

export interface IAddress extends Address {}

export class Courier implements HashIdObject, PublicKeyObject {
  hashId!: string; // hash of the remaining fields
  name!: string;
  company!: string;
  telephone!: string;
  publicKey!: KeyHexString;
}

export interface ICourier extends Courier {}

export class Good implements UuidObject {
  uuid!: string;
  name!: string;
  barcode!: string;
}

export interface IGood extends Good {}

export class Stop {
  address!: string; // Hash ID
  expectedArrivalTimestamp!: number;
  input!: { [goodUuid: string]: number };
  output!: { [goodUuid: string]: number };
  next: ITransport | undefined;
}

export interface IStop extends Stop {}

export class Transport {
  courier!: string; // Hash ID
  info!: string;
  destination!: IStop;
}

export interface ITransport extends Transport {}

export class CommitDetail {
  delta!: { [goodUuid: string]: number };
  info!: string;
  timestamp!: number;
}

export interface ICommitDetail extends CommitDetail {}

export class Commit {
  detail!: ICommitDetail;
  signature!: SignatureHexString;
}

export interface ICommit extends Commit {}

/**
 * Represents a point to point segment, a part of a route.
 */
export class Segment {
  srcOutgoing: ICommit | undefined;
  courierReceiving: ICommit | undefined;
  courierDelivering: ICommit | undefined;
  dstIncoming: ICommit | undefined;
}

export interface ISegment extends Segment {}

export class Route implements UuidObject {
  uuid!: string;
  goods!: { [goodUuid: string]: IGood };
  addresses!: { [addressHashId: string]: IAddress };
  couriers!: { [courierHashId: string]: ICourier };
  source!: IStop;
  commits!: ISegment[];
}

export interface IRoute extends Route {}

export class RouteProposal {
  route!: IRoute;
  signatures!: { [partyHashId: string]: SignatureHexString }; // partyHashId is the hashId of the address.
}

export interface IRouteProposal extends RouteProposal {}

export type ModelPrefix = "rp" | "rt" | "ad" | "cr";

export type ModelTypeMap = {
  rp: IRouteProposal;
  rt: IRoute;
  ad: IAddress;
  cr: ICourier;
};

export type TransportStep = "srcOutgoing" | "courierReceiving" | "courierDelivering" | "dstIncoming";
