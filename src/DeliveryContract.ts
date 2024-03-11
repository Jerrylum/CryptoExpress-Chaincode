// export {}

/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, Contract, Info, Transaction } from "fabric-contract-api";
import {
  ModelPrefix,
  ModelTypeMap,
  RouteProposal,
  Route,
  SignatureHexString,
  Address,
  Courier,
  Commit,
  TransportStep
} from "./Models";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import {
  validateRoute,
  isEmptySegmentList,
  verifyObject,
  isValidHashIdObject,
  isValidPublicKey
} from "./Utils";
import { RouteView } from "./RouteView";

@Info({ title: "DeliveryContract", description: "Smart Contract for handling delivery." })
export class DeliveryContract extends Contract {
  private async getAllValues<T extends ModelPrefix>(ctx: Context, prefix: T): Promise<ModelTypeMap[T][]> {
    const iterator = ctx.stub.getStateByRange(`${prefix}-`, `${prefix}.`);
    const result: ModelTypeMap[T][] = [];
    for await (const res of iterator) {
      result.push(SimpleJSONSerializer.deserialize(res.value));
    }
    return result;
  }

  private async getValue<T extends ModelPrefix>(
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

  @Transaction(false)
  public async getAllData(ctx: Context, prefix: string): Promise<any[]> {
    // The parameter "prefix" must be a string type,
    // Otherwise it will be a pure Object type and will not be able to be used in a Transaction.
    switch (prefix) {
      case "rp":
      case "rt":
      case "ad":
      case "cr":
        return this.getAllValues(ctx, prefix);
      default:
        throw new Error(`The prefix ${prefix} is not valid.`);
    }
  }

  @Transaction(false)
  public async getData(ctx: Context, prefix: string, uuid: string): Promise<any> {
    switch (prefix) {
      case "rp":
      case "rt":
      case "ad":
      case "cr":
        return this.getValue(ctx, prefix, uuid);
      default:
        throw new Error(`The prefix ${prefix} is not valid.`);
    }
  }

  @Transaction()
  public async createRouteProposal(ctx: Context, route: Route): Promise<RouteProposal> {
    validateRoute(route);

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
  public async removeRouteProposal(ctx: Context, routeUuid: string): Promise<void> {
    if (!(await this.getValue(ctx, "rp", routeUuid))) {
      throw new Error(`The route proposal ${routeUuid} does not exist.`);
    }

    await this.deleteValue(ctx, "rp", routeUuid);
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

    const entity: Address | Courier | undefined =
      route.addresses[entityHashId] || route.couriers[entityHashId] || undefined;

    if (!entity) {
      throw new Error(`The entity ${entityHashId} does not exist in the route.`);
    }

    if (routeProposal.signatures[entityHashId] !== undefined) {
      throw new Error(`The entity ${entityHashId} has already signed the route proposal.`);
    }

    const publicKey = entity.publicKey;

    if (!verifyObject(route, signature, publicKey)) {
      throw new Error(`The signature is not valid.`);
    }

    routeProposal.signatures[entityHashId] = signature;

    return await this.putValue(ctx, "rp", routeUuid, routeProposal);
  }

  @Transaction()
  public async submitRouteProposal(ctx: Context, routeUuid: string): Promise<Route> {
    const routeProposal = await this.getValue(ctx, "rp", routeUuid);

    if (!routeProposal) {
      throw new Error(`The route proposal ${routeUuid} does not exist.`);
    }

    const route = routeProposal.route;

    const allHashIdList = [...Object.keys(route.addresses), ...Object.keys(route.couriers)];

    if (Object.keys(routeProposal.signatures).length !== allHashIdList.length) {
      throw new Error(`The route proposal is not fully signed.`);
    }

    await this.deleteValue(ctx, "rp", routeUuid);
    await this.putValue(ctx, "rt", routeUuid, route);

    return route;
  }

  @Transaction()
  public async commitProgress(
    ctx: Context,
    routeUuid: string,
    segmentIndex: number,
    step: TransportStep,
    commit: Commit
  ): Promise<void> {
    const route = await this.getValue(ctx, "rt", routeUuid);

    if (!route) {
      throw new Error(`The route ${routeUuid} does not exist.`);
    }

    const currentSegment = route.commits[segmentIndex];
    if (!currentSegment) {
      throw new Error(`The segment ${segmentIndex} does not exist.`);
    }

    const currentStep = currentSegment[step];
    if (currentStep) {
      throw new Error(`The step ${step} is already committed.`);
    }

    const routeView = new RouteView(route);

    const previousMoment = routeView.moments.filter(t => t !== null).at(-1);
    if (previousMoment && commit.detail.timestamp < previousMoment.actualTimestamp!) {
      throw new Error(`The commit is not in the correct order.`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (commit.detail.timestamp < now - 60 || commit.detail.timestamp > now + 60) {
      throw new Error(`The commit timestamp is not within one minute.`);
    }

    const publicKey = routeView.transports[segmentIndex][step].entity.publicKey;
    if (verifyObject(commit.detail, commit.signature, publicKey)) {
      throw new Error(`The commit signature is not valid.`);
    }

    currentSegment[step] = commit;

    await this.putValue(ctx, "rt", routeUuid, route);
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
    if (!(await this.getValue(ctx, "ad", hashId))) {
      throw new Error(`The address ${hashId} does not exist.`);
    }

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
    if (!(await this.getValue(ctx, "cr", hashId))) {
      throw new Error(`The courier ${hashId} does not exist.`);
    }

    await this.deleteValue(ctx, "cr", hashId);
  }
}
