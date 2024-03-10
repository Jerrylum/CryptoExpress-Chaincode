import {
  createHash,
  createVerify,
  KeyObject,
  createPublicKey,
  KeyPairKeyObjectResult,
  generateKeyPairSync,
  createSign,
  createPrivateKey
} from "crypto";
import {
  HashIdObject,
  KeyHexString,
  PublicKeyObject,
  Stop,
  Transport,
  Segment,
  Route,
  SignatureHexString,
  Commit,
  UuidObject,
  Address,
  TransportStep,
  Courier
} from "./Models";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";

export function omitProperty<T, K extends keyof any>(obj: T, keyToOmit: K): Omit<T, K> {
  const { [keyToOmit]: _, ...rest } = obj;
  return rest;
}

export function isValidHashIdObject(target: HashIdObject) {
  const hashObj = omitProperty(target, "hashId");
  return objectToSha256Hash(hashObj) === target.hashId;
}

export function isValidHashIdObjectCollection(target: { [hashId: string]: HashIdObject }) {
  return Object.keys(target).every(hashId => target[hashId].hashId === hashId && isValidHashIdObject(target[hashId]));
}

export function isValidPublicKey(target: KeyHexString) {
  try {
    importPublicKey(target);
    return true;
  } catch (e) {
    return false;
  }
}

export function isValidPublicKeyObjectCollection(target: { [hashId: string]: PublicKeyObject }) {
  return Object.keys(target).every(hashId => isValidPublicKey(target[hashId].publicKey));
}

export function isValidUuid(target: string) {
  return target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
}

export function isValidUuidObjectCollection(target: { [uuid: string]: UuidObject }) {
  return Object.keys(target).every(uuid => target[uuid].uuid === uuid && isValidUuid(target[uuid].uuid));
}

export function isValidRouteDetail(
  addressHashIds: string[],
  courierHashIds: string[],
  goodsUuids: string[],
  firstStop: Stop
) {
  let stop: Stop | undefined = firstStop;
  let transport: Transport | undefined = stop.next;

  let currentTimestamp = 0;

  // There should be at least two stops in a route.
  if (transport === undefined) {
    return false;
  }

  while (transport) {
    if (!addressHashIds.includes(stop.address)) {
      return false;
    }

    if (stop.expectedArrivalTimestamp < currentTimestamp) {
      return false;
    }
    currentTimestamp = stop.expectedArrivalTimestamp;

    if (
      !Object.keys(stop.input).every(uuid => goodsUuids.includes(uuid)) ||
      !Object.keys(stop.output).every(uuid => goodsUuids.includes(uuid))
    ) {
      return false;
    }

    if (!courierHashIds.includes(transport.courier)) {
      return false;
    }

    // The stop impossible to be undefined, since the JSON schema has been validated, the case a object set of 1 stop + 1 transport will be slashed.
    stop = transport.destination;
    transport = stop.next;
  }
  return true;
}

export function objectToSha256Hash(obj: any): string {
  const hash = createHash("sha256");
  hash.update(SimpleJSONSerializer.serialize(obj));
  return hash.digest("hex");
}

export function isEmptySegment(segment: Segment) {
  return (
    segment.srcOutgoing === undefined &&
    segment.courierReceiving === undefined &&
    segment.courierDelivering === undefined &&
    segment.dstIncoming === undefined
  );
}

export function isEmptySegmentList(segments: Segment[]) {
  return segments.every(isEmptySegment);
}

export function validateRoute(route: Route): boolean {
  const uuid = route.uuid;
  const goods = route.goods;
  const addressBook = route.addresses;
  const courierBook = route.couriers;

  if (!isValidUuid(uuid)) {
    throw new Error(`The route proposal uuid is not valid.`);
  }

  if (!isValidUuidObjectCollection(goods)) {
    throw new Error(`One of the goods uuid is not valid.`);
  }

  if (!isValidHashIdObjectCollection(addressBook)) {
    throw new Error(`One of the address hash is not valid.`);
  }

  if (!isValidPublicKeyObjectCollection(addressBook)) {
    throw new Error(`One of the address public key is not valid.`);
  }

  if (!isValidHashIdObjectCollection(courierBook)) {
    throw new Error(`One of the courier hash is not valid.`);
  }

  if (!isValidPublicKeyObjectCollection(courierBook)) {
    throw new Error(`One of the courier public key is not valid.`);
  }

  const addressHashIdList = Object.keys(addressBook);
  const courierHashIdList = Object.keys(courierBook);
  const goodsSet = Object.keys(goods);

  if (!isValidRouteDetail(addressHashIdList, courierHashIdList, goodsSet, route.source)) {
    throw new Error(`The route detail is not valid.`);
  }

  let count = 0;
  let stop = route.source;
  while (stop.next) {
    count++;
    stop = stop.next.destination;
  }

  if (count !== route.commits.length) {
    throw new Error(`The number of segments does not match the number of transport.`);
  }

  return true;
}

export function getCommitTimeline(route: Route): Commit[] {
  let commits: Commit[] = [];

  route.commits.forEach(segment => {
    if (segment.srcOutgoing) {
      commits.push(segment.srcOutgoing);
    }
    if (segment.courierReceiving) {
      commits.push(segment.courierReceiving);
    }
    if (segment.courierDelivering) {
      commits.push(segment.courierDelivering);
    }
    if (segment.dstIncoming) {
      commits.push(segment.dstIncoming);
    }
  });

  return commits;
}

export function signObject(target: any, privateKey: KeyHexString): SignatureHexString {
  const sign = createSign("SHA256");
  sign.update(SimpleJSONSerializer.serialize(target));
  sign.end();
  return sign.sign(importPrivateKey(privateKey), "hex");
}

export function verifyObject(target: any, signature: SignatureHexString, publicKey: KeyHexString): boolean {
  const verify = createVerify("SHA256");
  verify.update(SimpleJSONSerializer.serialize(target));
  verify.end();
  return verify.verify(importPublicKey(publicKey), signature, "hex");
}

export function exportPublicKey(key: KeyObject) {
  return key.export({ type: "spki", format: "der" }).toString("hex");
}

export function exportPrivateKey(key: KeyObject) {
  return key.export({ type: "sec1", format: "der" }).toString("hex");
}

export function importPublicKey(key: string) {
  return createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.from(key, "hex")
  });
}

export function importPrivateKey(key: string) {
  return createPrivateKey({
    format: "der",
    type: "sec1",
    key: Buffer.from(key, "hex")
  });
}

export function generateKeyPair(): KeyPairKeyObjectResult {
  return generateKeyPairSync("ec", { namedCurve: "sect239k1" });
}
