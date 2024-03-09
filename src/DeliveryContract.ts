// export {}

/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, Contract, Info, Transaction } from "fabric-contract-api";
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
import { validateRoute, isEmptySegmentList, verifyObject, isValidHashIdObject, isValidPublicKey } from "./Utils";

@Info({ title: "DeliveryContract", description: "Smart Contract for handling delivery." })
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

  // convert

  // commit

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
