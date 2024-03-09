export type KeyHexString = string;

export class Address {
  hashId!: string; // hash of the remaining fields
  line1!: string;
  line2!: string;
  recipient!: string;
  publicKey!: KeyHexString;
}

export interface IAddress extends Address {}

export class Courier {
  hashId!: string; // hash of the remaining fields
  name!: string;
  company!: string;
  telephone!: string;
  publicKey!: KeyHexString;
}

export interface ICourier extends Courier {}

export class Good {
  uuid!: string;
  name!: string;
  barcode!: string;
}

export interface IGood extends Good {}

export class Stop {
  address!: string; // Hash ID
  arrivalDeltaTimestamp!: number;
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
  signature!: KeyHexString;
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

export class Route {
  uuid!: string;
  goods!: { [goodUuid: string]: number };
  addresses!: { [addressHashId: string]: IAddress };
  couriers!: { [courierHashId: string]: ICourier };
  source!: IStop;
  commits!: ISegment[];
}

export interface IRoute extends Route {}

export class RouteProposal {
  route!: IRoute;
  signatures!: { [partyHashId: string]: KeyHexString }; // partyHashId is the hashId of the address.
}

export interface IRouteProposal extends RouteProposal {}
