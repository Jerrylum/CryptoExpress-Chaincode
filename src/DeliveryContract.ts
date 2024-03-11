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
  TransportStep,
  TransportStepIndexMap
} from "./Models";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import { validateRoute, isEmptySegmentList, verifyObject, isValidHashIdObject, isValidPublicKey } from "./Utils";
import { RouteMoment, RouteView } from "./RouteView";

@Info({ title: "DeliveryContract", description: "Smart Contract for handling delivery." })
export class DeliveryContract extends Contract {
  /**
   * The getAllValues function is a helper function to get all the values of a specific prefix.
   * @param ctx The transaction context.
   * @param prefix The prefix of the model.
   * @returns The array of the model values.
   */
  private async getAllValues<T extends ModelPrefix>(ctx: Context, prefix: T): Promise<ModelTypeMap[T][]> {
    const iterator = ctx.stub.getStateByRange(`${prefix}-`, `${prefix}.`);
    const result: ModelTypeMap[T][] = [];
    for await (const res of iterator) {
      result.push(SimpleJSONSerializer.deserialize(res.value));
    }
    return result;
  }

  /**
   * The getValue function is a helper function to get the value of a specific prefix and uuid.
   * @param ctx The transaction context.
   * @param prefix The prefix of the model.
   * @param uuid The uuid of the model.
   * @returns The model value or undefined if not found.
   */
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

  /**
   * The putValue function is a helper function to put the value of a specific prefix and uuid.
   * @param ctx The transaction context.
   * @param prefix The prefix of the model.
   * @param uuid The uuid of the model.
   * @param value The value of the model.
   * @returns The value of the model.
   */
  private async putValue<T extends ModelPrefix>(
    ctx: Context,
    prefix: T,
    uuid: string,
    value: ModelTypeMap[T]
  ): Promise<ModelTypeMap[T]> {
    await ctx.stub.putState(`${prefix}-${uuid}`, SimpleJSONSerializer.serialize(value));
    return value;
  }

  /**
   * The deleteValue function is a helper function to delete the value of a specific prefix and uuid.
   * @param ctx The transaction context.
   * @param prefix The prefix of the model.
   * @param uuid The uuid of the model.
   */
  private async deleteValue<T extends ModelPrefix>(ctx: Context, prefix: T, uuid: string): Promise<void> {
    await ctx.stub.deleteState(`${prefix}-${uuid}`);
  }

  /**
   * The getAllData function is a transaction function to get all the values of a specific prefix.
   * @param ctx The transaction context.
   * @param prefix The prefix of the model.
   * @returns The array of the model values.
   */
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

  /**
   * The getData function is a transaction function to get the value of a specific prefix and uuid.
   * @param ctx The transaction context.
   * @param prefix The prefix of the model.
   * @param uuid The uuid of the model.
   * @returns The model value or undefined if not found.
   */
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

  /**
   * The createRouteProposal function is a transaction function to create a route proposal.
   * @param ctx The transaction context.
   * @param route The route proposal.
   * @returns The route proposal.
   */
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

  /**
   * The removeRouteProposal function is a transaction function to remove a route proposal.
   * @param ctx The transaction context.
   * @param routeUuid The uuid of the route proposal.
   */
  @Transaction()
  public async removeRouteProposal(ctx: Context, routeUuid: string): Promise<void> {
    if (!(await this.getValue(ctx, "rp", routeUuid))) {
      throw new Error(`The route proposal ${routeUuid} does not exist.`);
    }

    await this.deleteValue(ctx, "rp", routeUuid);
  }

  /**
   * The signRouteProposal function is a transaction function to sign a route proposal.
   * @param ctx The transaction context.
   * @param routeUuid The uuid of the route proposal.
   * @param entityHashId The hashId of the entity.
   * @param signature The signature of the entity.
   * @returns The route proposal.
   */
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

  /**
   * The submitRouteProposal function is a transaction function to submit a route proposal.
   * @param ctx The transaction context.
   * @param routeUuid The uuid of the route proposal.
   * @returns The route.
   */
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

  /**
   * The commitProgress function is a transaction function to commit the progress of a route.
   * @param ctx The transaction context.
   * @param routeUuid The uuid of the route.
   * @param segmentIndex The index of the segment.
   * @param step The step of the transport.
   * @param commit The commit.
   */
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

    if (segmentIndex < 0 || segmentIndex >= route.commits.length) {
      throw new Error(`The segment index ${segmentIndex} is not valid.`);
    }

    if (TransportStepIndexMap.includes(step) === false) {
      throw new Error(`The step ${step} is not valid.`);
    }

    const routeView = new RouteView(route);

    const currentMomentIndex = segmentIndex * 4 + TransportStepIndexMap.indexOf(step);
    const currentMoment = routeView.moments[currentMomentIndex];
    const previousMoment = routeView.moments[currentMomentIndex - 1] as RouteMoment | undefined;

    // The current moment will not be undefined, just the actualTimestamp will be null.
    if (currentMoment.actualTimestamp !== null) {
      throw new Error(`The current moment is already committed.`);
    }

    if (previousMoment) {
      if (previousMoment.actualTimestamp === null) {
        throw new Error(`The previous moment is not committed.`);
      }

      if (previousMoment.actualTimestamp > commit.detail.timestamp) {
        throw new Error(`The commit is not in the correct order.`);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    if (commit.detail.timestamp < now - 60 || commit.detail.timestamp > now + 60) {
      throw new Error(`The commit timestamp is not within one minute.`);
    }

    const publicKey = routeView.transports[segmentIndex][step].entity.publicKey;
    if (verifyObject(commit.detail, commit.signature, publicKey) === false) {
      throw new Error(`The commit signature is not valid.`);
    }

    route.commits[segmentIndex][step] = commit;

    await this.putValue(ctx, "rt", routeUuid, route);
  }

  /**
   * The releaseAddress function is a transaction function to create an address.
   * @param ctx The transaction context.
   * @param address The address.
   * @returns The address.
   */
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

  /**
   * The removeAddress function is a transaction function to remove an address.
   * @param ctx The transaction context.
   * @param hashId The hashId of the address.
   * @returns The address.
   */
  @Transaction()
  public async removeAddress(ctx: Context, hashId: string): Promise<void> {
    if (!(await this.getValue(ctx, "ad", hashId))) {
      throw new Error(`The address ${hashId} does not exist.`);
    }

    await this.deleteValue(ctx, "ad", hashId);
  }

  /**
   * The createCourier function is a transaction function to create a courier.
   * @param ctx The transaction context.
   * @param courier The courier.
   * @returns The courier.
   */
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

  /**
   * The removeCourier function is a transaction function to remove a courier.
   * @param ctx The transaction context.
   * @param hashId The hashId of the courier.
   * @returns The courier.
   */
  @Transaction()
  public async removeCourier(ctx: Context, hashId: string): Promise<void> {
    if (!(await this.getValue(ctx, "cr", hashId))) {
      throw new Error(`The courier ${hashId} does not exist.`);
    }

    await this.deleteValue(ctx, "cr", hashId);
  }
}
