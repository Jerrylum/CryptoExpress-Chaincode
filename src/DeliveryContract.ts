// export {}

/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import { Buffer } from "buffer";
import { KeyObject, generateKeyPairSync, createPublicKey, createSign, createVerify, createHash } from "node:crypto";
import {
  IRouteProposal,
  IAddress,
  ICourier,
  ModelPrefix,
  ModelTypeMap,
  RouteProposal,
  Route,
  IStop,
  ITransport,
  Segment,
  SignatureHexString,
  KeyHexString,
  Address,
  HashIdObject,
  PublicKeyObject,
  Courier
} from "./Models";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";

// state standards
// ctx.stub.putState("rp-uuid", Buffer.from("{ }")); // route proposal
// ctx.stub.putState("ad-hashId", Buffer.from("{ }")); // address
// ctx.stub.putState("cr-hashId", Buffer.from("{ }")); // courier
// ctx.stub.putState("gs-uuid", Buffer.from("{ }")); // goods
// ctx.stub.getStateByRange("rp-", "rp-"); // get all route proposals

function omitProperty<T, K extends keyof any>(obj: T, keyToOmit: K): Omit<T, K> {
  const { [keyToOmit]: _, ...rest } = obj;
  return rest;
}

function isValidHashIdObject(target: HashIdObject) {
  const hashObj = omitProperty(target, "hashId");
  return objectToSha256Hash(hashObj) === target.hashId;
}

function isValidHashIdObjectCollection(target: { [hashId: string]: HashIdObject }) {
  for (const hashId in Object.keys(target)) {
    if (target[hashId].hashId !== hashId || !isValidHashIdObject(target[hashId])) {
      return false;
    }
  }
  return true;
}

function isValidPublicKey(target: KeyHexString) {
  try {
    importKey(target);
    return true;
  } catch (e) {
    return false;
  }
}

function isValidPublicKeyObjectCollection(target: { [hashId: string]: PublicKeyObject }) {
  for (const hashId in Object.keys(target)) {
    if (!isValidPublicKey(target[hashId].publicKey)) {
      return false;
    }
  }
  return true;
}

function isValidUuid(target: string) {
  return target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
}

function isValidUuidObjectCollection(target: { [uuid: string]: any }) {
  for (const uuid in Object.keys(target)) {
    if (target[uuid].uuid !== uuid || !isValidUuid(target[uuid].uuid)) {
      return false;
    }
  }
  return true;
}

function isValidRouteDetail(
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

function objectToSha256Hash(obj: any): string {
  const hash = createHash("sha256");
  hash.update(SimpleJSONSerializer.deserialize(obj));
  return hash.digest("hex");
}

function isEmptySegment(segment: Segment) {
  return (
    segment.srcOutgoing === undefined &&
    segment.courierReceiving === undefined &&
    segment.courierDelivering === undefined &&
    segment.dstIncoming === undefined
  );
}

function isEmptySegmentList(segments: Segment[]) {
  return segments.every(isEmptySegment);
}

function validateRoute(route: Route): boolean {
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

function verifyObject(target: any, signature: SignatureHexString, publicKey: KeyHexString): boolean {
  const verify = createVerify("SHA256");
  verify.update(SimpleJSONSerializer.serialize(target));
  verify.end();
  return verify.verify(importKey(publicKey), signature, "hex");
}

function exportKey(key: KeyObject) {
  return key.export({ type: "spki", format: "der" }).toString("hex");
}

function importKey(key: string) {
  return createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.from(key, "hex")
  });
}

@Info({ title: "DeliveryChain", description: "Smart Contract for handling delivery chain." })
export class DeliveryContract extends Contract {
  @Transaction(false)
  public async getAllValues<T extends ModelPrefix>(ctx: Context, prefix: T): Promise<ModelTypeMap[T][]> {
    const iterator = await ctx.stub.getStateByRange(`${prefix}-`, `${prefix}-`);
    const result: ModelTypeMap[T][] = [];
    let res = await iterator.next();
    while (!res.done) {
      result.push(SimpleJSONSerializer.deserialize(res.value.value));
      res = await iterator.next();
    }
    return result;
  }

  @Transaction(false)
  public async getValue<T extends ModelPrefix>(
    ctx: Context,
    prefix: T,
    uuid: string
  ): Promise<ModelTypeMap[T] | undefined> {
    const data = await ctx.stub.getState(`${prefix}-${uuid}`);
    if (!data || data.length === 0) {
      return undefined;
    }
    return SimpleJSONSerializer.deserialize(data);
  }

  private async putValue<T extends ModelPrefix>(
    ctx: Context,
    prefix: T,
    uuid: string,
    value: ModelTypeMap[T]
  ): Promise<ModelTypeMap[T]> {
    await ctx.stub.putState(`${prefix}-${uuid}`, SimpleJSONSerializer.serialize(value));
    return value;
  }

  private async deleteValue<T extends ModelPrefix>(ctx: Context, prefix: T, uuid: string): Promise<void> {
    await ctx.stub.deleteState(`${prefix}-${uuid}`);
  }

  @Transaction()
  public async createRouteProposal(ctx: Context, route: Route): Promise<RouteProposal> {
    validateRoute(route);

    let count = 0;
    let stop = route.source;
    while (stop.next) {
      count++;
      stop = stop.next.destination;
    }

    if (count !== route.commits.length) {
      throw new Error(`The number of segments does not match the number of transport.`);
    }

    if (!isEmptySegmentList(route.commits)) {
      throw new Error(`One of the commit is not empty.`);
    }

    const routeProposal: RouteProposal = {
      route,
      signatures: {}
    };

    // It is possible to overwrite existing proposal with the same uuid.
    return this.putValue(ctx, "rp", route.uuid, routeProposal);
  }

  @Transaction()
  public async signRouteProposal(
    ctx: Context,
    routeUuid: string,
    entityHashId: string,
    signature: SignatureHexString
  ): Promise<RouteProposal> {
    const routeProposal = await this.getValue(ctx, "rp", routeUuid);

    if (!routeProposal) {
      throw new Error(`The route proposal ${routeUuid} does not exist.`);
    }

    const route = routeProposal.route;

    const entity: IAddress | ICourier | undefined =
      route.addresses[entityHashId] || route.couriers[entityHashId] || undefined;

    if (!entity) {
      throw new Error(`The entity ${entityHashId} does not exist in the route.`);
    }

    const publicKey = entity.publicKey;

    if (!verifyObject(route, signature, publicKey)) {
      throw new Error(`The signature is not valid.`);
    }

    routeProposal.signatures[entityHashId] = signature;

    return await this.putValue(ctx, "rp", routeUuid, routeProposal);
  }

  @Transaction()
  public async releaseAddress(ctx: Context, address: Address): Promise<void> {
    if (!isValidHashIdObject(address)) {
      throw new Error(`The address hashId is not valid.`);
    }

    if (!isValidPublicKey(address.publicKey)) {
      throw new Error(`The public key is not valid.`);
    }

    this.putValue(ctx, "ad", address.hashId, address);
  }

  @Transaction()
  public async removeAddress(ctx: Context, hashId: string): Promise<void> {
    await this.deleteValue(ctx, "ad", hashId);
  }

  @Transaction()
  public async releaseCourier(ctx: Context, courier: Courier): Promise<void> {
    if (!isValidHashIdObject(courier)) {
      throw new Error(`The courier hashId is not valid.`);
    }

    if (!isValidPublicKey(courier.publicKey)) {
      throw new Error(`The public key is not valid.`);
    }

    this.putValue(ctx, "cr", courier.hashId, courier);
  }

  @Transaction()
  public async removeCourier(ctx: Context, hashId: string): Promise<void> {
    await this.deleteValue(ctx, "cr", hashId);
  }
}
