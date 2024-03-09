import { createHash, createVerify, KeyObject, createPublicKey, KeyPairKeyObjectResult, generateKeyPairSync } from "crypto";
import { HashIdObject, KeyHexString, PublicKeyObject, IStop, ITransport, Segment, Route, SignatureHexString } from "./Models";
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
  for (const hashId in Object.keys(target)) {
    if (target[hashId].hashId !== hashId || !isValidHashIdObject(target[hashId])) {
      return false;
    }
  }
  return true;
}

export function isValidPublicKey(target: KeyHexString) {
  try {
    importKey(target);
    return true;
  } catch (e) {
    return false;
  }
}

export function isValidPublicKeyObjectCollection(target: { [hashId: string]: PublicKeyObject }) {
  for (const hashId in Object.keys(target)) {
    if (!isValidPublicKey(target[hashId].publicKey)) {
      return false;
    }
  }
  return true;
}

export function isValidUuid(target: string) {
  return target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
}

export function isValidUuidObjectCollection(target: { [uuid: string]: any }) {
  for (const uuid in Object.keys(target)) {
    if (target[uuid].uuid !== uuid || !isValidUuid(target[uuid].uuid)) {
      return false;
    }
  }
  return true;
}

export function isValidRouteDetail(
  addressHashIds: string[],
  courierHashIds: string[],
  goodsUuids: string[],
  firstStop: IStop
) {
  let stop: IStop | undefined = firstStop;
  let transport: ITransport | undefined = stop.next;

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

    for (const uuid in [...Object.keys(stop.input), ...Object.keys(stop.output)]) {
      if (!goodsUuids.includes(uuid)) {
        return false;
      }
    }

    if (!courierHashIds.includes(transport.courier)) {
      return false;
    }

    stop = transport.destination;
    transport = stop.next;
  }
}

export function objectToSha256Hash(obj: any): string {
  const hash = createHash("sha256");
  hash.update(SimpleJSONSerializer.deserialize(obj));
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

  return true;
}

// TODO signObject

export function verifyObject(target: any, signature: SignatureHexString, publicKey: KeyHexString): boolean {
  const verify = createVerify("SHA256");
  verify.update(SimpleJSONSerializer.serialize(target));
  verify.end();
  return verify.verify(importKey(publicKey), signature, "hex");
}

export function exportKey(key: KeyObject) {
  return key.export({ type: "spki", format: "der" }).toString("hex");
}

export function importKey(key: string) {
  return createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.from(key, "hex")
  });
}

export function generateKeyPair(): KeyPairKeyObjectResult {
  return generateKeyPairSync("ec", { namedCurve: "sect239k1" });
}
