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
  UuidObject
} from "./Models";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";

/**
 * The omitProperty function is used to remove a property from an object.
 * @param obj The object to remove the property from.
 * @param keyToOmit The property to remove from the object.
 */
export function omitProperty<T, K extends keyof any>(obj: T, keyToOmit: K): Omit<T, K> {
  const { [keyToOmit]: _, ...rest } = obj;
  return rest;
}

/**
 * The isValidHashIdObject function is used to validate a HashIdObject.
 * @param target The object to validate.
 */
export function isValidHashIdObject(target: HashIdObject) {
  const hashObj = omitProperty(target, "hashId");
  return objectToSha256Hash(hashObj) === target.hashId;
}

/**
 * The isValidHashIdObjectCollection function is used to validate a collection of HashIdObjects.
 * @param target The collection to validate.
 */
export function isValidHashIdObjectCollection(target: { [hashId: string]: HashIdObject }) {
  return Object.keys(target).every(hashId => target[hashId].hashId === hashId && isValidHashIdObject(target[hashId]));
}

/**
 * The isValidPublicKey function is used to validate a public key.
 * @param target The public key to validate.
 */
export function isValidPublicKey(target: KeyHexString) {
  try {
    importPublicKey(target);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * The isValidPublicKeyObjectCollection function is used to validate a collection of public keys.
 * @param target The collection to validate.
 */
export function isValidPublicKeyObjectCollection(target: { [hashId: string]: PublicKeyObject }) {
  return Object.keys(target).every(hashId => isValidPublicKey(target[hashId].publicKey));
}

/**
 * The isValidUuid function is used to validate a UUID.
 * @param target The UUID to validate.
 */
export function isValidUuid(target: string) {
  return target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
}

/**
 * The isValidUuidObject function is used to validate a UuidObject.
 * @param target The object to validate.
 */
export function isValidUuidObjectCollection(target: { [uuid: string]: UuidObject }) {
  return Object.keys(target).every(uuid => target[uuid].uuid === uuid && isValidUuid(target[uuid].uuid));
}

/**
 * The isValidRouteDetail function is used to validate the detail of a route.
 * @param addressHashIds The collection of address hash IDs.
 * @param courierHashIds The collection of courier hash IDs.
 * @param goodsUuids The collection of goods UUIDs.
 * @param firstStop The first stop of the route.
 */
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
    // The stop address is not in the route address book.
    if (!addressHashIds.includes(stop.address)) {
      return false;
    }

    // The stop timestamp is in the pass, invalid.
    if (stop.expectedArrivalTimestamp < currentTimestamp) {
      return false;
    }
    currentTimestamp = stop.expectedArrivalTimestamp;

    // The goods is not in the neither the input nor the output of the stop.
    if (
      !Object.keys(stop.input).every(uuid => goodsUuids.includes(uuid)) ||
      !Object.keys(stop.output).every(uuid => goodsUuids.includes(uuid))
    ) {
      return false;
    }

    // The transport courier is not in the route courier book.
    if (!courierHashIds.includes(transport.courier)) {
      return false;
    }

    // The stop impossible to be undefined, since the JSON schema has been validated, the case a object set of 1 stop + 1 transport will be slashed.
    stop = transport.destination;
    transport = stop.next;
  }
  return true;
}

/**
 * The sortObjectKeys function is used to sort the keys of an object.
 * @param unsortedObject The object to sort the keys of.
 * @returns The object with the sorted keys in ascending order.
 */
export function sortObjectKeys(unsortedObject: {} | null): {} | null {
  if (typeof unsortedObject !== "object" || unsortedObject === null) {
    return unsortedObject;
  }

  return Object.keys(unsortedObject)
    .sort()
    .reduce((acc: {}, key) => {
      (acc as any)[key] = (unsortedObject as any)[key];
      return acc;
    }, {});
}

/**
 * The objectToSha256Hash function is used to generate a SHA256 hash from an object.
 * @param obj The object to hash.
 */
export function objectToSha256Hash(obj: {} | null): string {
  const hash = createHash("sha256");
  hash.update(SimpleJSONSerializer.serialize(sortObjectKeys(obj)));
  return hash.digest("hex");
}

/**
 * The isEmptySegment function is used to check if a segment has not been signed.
 * @param segment The segment to check.
 */
export function isEmptySegment(segment: Segment) {
  return (
    segment.srcOutgoing === undefined &&
    segment.courierReceiving === undefined &&
    segment.courierDelivering === undefined &&
    segment.dstIncoming === undefined
  );
}

/**
 * The isEmptySegmentList function is used to check if a list of segments has not been signed.
 * @param segments The list of segments to check.
 */
export function isEmptySegmentList(segments: Segment[]) {
  return segments.every(isEmptySegment);
}

/**
 * The validateRoute function is used to validate a route.
 * @param route The route to validate.
 */
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

/**
 * The getCommitTimeline function is used to get the commit timeline from a route.
 * @param route The route to get the commit timeline from.
 */
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

/**
 * The createHashIdObject function is used to create a HashIdObject.
 * @param obj The object to create the HashIdObject from.
 */
export function createHashIdObject<T extends HashIdObject>(obj: Omit<T, "hashId">): T {
  const rtn = obj as T;
  rtn.hashId = objectToSha256Hash(omitProperty(obj, "hashId"));
  return rtn;
}

/**
 * The createPublicKeyObject function is used to create a PublicKeyObject.
 * @param publicKey The public key to create the PublicKeyObject from.
 */
export function signObject(target: {} | null, privateKey: KeyHexString): SignatureHexString {
  const sign = createSign("SHA256");
  sign.update(SimpleJSONSerializer.serialize(target));
  sign.end();
  return sign.sign(importPrivateKey(privateKey), "hex");
}

/**
 * The verifyObject function is used to verify a signature.
 * @param target The object to verify.
 * @param signature The signature to verify.
 * @param publicKey The public key to verify the signature with.
 */
export function verifyObject(target: {} | null, signature: SignatureHexString, publicKey: KeyHexString): boolean {
  const verify = createVerify("SHA256");
  verify.update(SimpleJSONSerializer.serialize(target));
  verify.end();
  return verify.verify(importPublicKey(publicKey), signature, "hex");
}

/**
 * The createUuidObject function is used to create a UuidObject.
 * @param obj The object to create the UuidObject from.
 */
export function exportPublicKey(key: KeyObject) {
  return key.export({ type: "spki", format: "der" }).toString("hex");
}

/**
 * The exportPrivateKey function is used to export a private key.
 * @param key The key to export.
 */
export function exportPrivateKey(key: KeyObject) {
  return key.export({ type: "sec1", format: "der" }).toString("hex");
}

/**
 * The importPublicKey function is used to import a public key.
 * @param key The key to import.
 */
export function importPublicKey(key: string) {
  return createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.from(key, "hex")
  });
}

/**
 * The importPrivateKey function is used to import a private key.
 * @param key The key to import.
 */
export function importPrivateKey(key: string) {
  return createPrivateKey({
    format: "der",
    type: "sec1",
    key: Buffer.from(key, "hex")
  });
}

/**
 * The generateKeyPair function is used to generate a key pair with the ECDSA algorithm and the sect239k1 curve for signing and verification.
 */
export function generateKeyPair(): KeyPairKeyObjectResult {
  return generateKeyPairSync("ec", { namedCurve: "sect239k1" });
}
