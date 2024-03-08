// export {}

/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { IRouteProposal } from "Models";
import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import { Buffer } from "buffer";
import { generateKeyPairSync, createSign, createVerify, createHash } from "node:crypto";

@Info({ title: "DeliveryChain", description: "Smart Contract for handling delivery chain." })
export class DeliveryContract extends Contract {
  @Transaction(false)
  @Returns("boolean")
  public async routeExists(ctx: Context, routeUuid: string): Promise<boolean> {
    // ctx.stub.putState("proposals", Buffer.from("{ \"uuid1\": {}, ... }"));
    // ctx.stub.putState("proposals", Buffer.from("[ \"uuid1\", ... ]"));
    // ctx.stub.putState("routes", Buffer.from("[ \"uuid1\", ... ]"));
    // ctx.stub.putState("addressBook", Buffer.from("{ }"));
    // ctx.stub.putState("courierBook", Buffer.from("{ }"));
    // ctx.stub.putState("ad-hashId1", Buffer.from("{ }"));
    // ctx.stub.putState("pp-uuid1", Buffer.from("{ }"));
    // ctx.stub.putState("rt-uuid1", Buffer.from("{ }"));

    ctx.stub.putState("pp-uuid1", Buffer.from("{ route: {...}, sign: {} }"));
    ctx.stub.putState("pp-uuid1", Buffer.from("{ route: {...}, sign: {a: ...} }"));
    ctx.stub.putState("pp-uuid1", Buffer.from("{ route: {...}, sign: {a: ..., b: ...} }"));

    ctx.stub.getStateByRange("pp-", "pp-");

    const data = await ctx.stub.getState(routeUuid);
    return !!data && data.length > 0;
  }

  @Transaction()
  public async createRouteProposal(ctx: Context, routeProposalJsonStr: string): Promise<void> {
    const routeProposal = JSON.parse(routeProposalJsonStr) as IRouteProposal;

    const exists: boolean = await this.routeExists(ctx, routeProposal.route.uuid);
    if (exists) {
        throw new Error(`The route proposal ${routeProposal.route.uuid} already exists.`);
    }
    //check the address book and courier book TODO
    const buffer = Buffer.from(JSON.stringify(routeProposal));
    await ctx.stub.putState(routeProposal.route.uuid, buffer);
  }
  
  @Transaction()
  public async signRouteProposal(ctx: Context, routeId: string, address: string, sign: string): Promise<void> {
    const routeProposal = await this.readRouteProposal(ctx, routeId);
    // for each key in routeProposal.signatures
    const addressBook = routeProposal.route.addresses;
    const courierBook = routeProposal.route.couriers;
    var pk = undefined;
    for(const key in Object.keys(routeProposal.signatures)) {
      if (Object.keys(addressBook).includes(key)) {
        pk = addressBook[key].publicKey.data;
      }else if (Object.keys(courierBook).includes(key)) {
        pk = courierBook[key].publicKey.data;
      }
      // verify the signature TODO
    }
  }

  // @Transaction()
  // public async shipProductTo(ctx: Context, productId: string, newLocation: string, arrivalDate: string): Promise<void> {
  //     const exists: boolean = await this.productExists(ctx, productId);
  //     if (!exists) {
  //         throw new Error(`The product ${productId} does not exist.`);
  //     }

  //     this.requireField(newLocation, 'newLocation');
  //     this.requireField(arrivalDate, 'arrivalDate');

  //     const product = await this.readProduct(ctx, productId);

  //     product.locationData.previous.push(new ProductLocationEntry({
  //         arrivalDate: product.locationData.current.arrivalDate,
  //         location: product.locationData.current.location
  //     }));
  //     product.locationData.current.arrivalDate = arrivalDate;
  //     product.locationData.current.location = newLocation;

  //     const buffer = Buffer.from(JSON.stringify(product));
  //     await ctx.stub.putState(productId, buffer);
  // }

  // @Transaction(false)
  // @Returns('Product')
  // public async getProduct(ctx: Context, productId: string): Promise<Product> {
  //     const exists: boolean = await this.productExists(ctx, productId);
  //     if (!exists) {
  //         throw new Error(`The product ${productId} does not exist.`);
  //     }

  //     return this.readProduct(ctx, productId);
  // }

  // @Transaction(false)
  // @Returns('ProductHistory')
  // public async getProductWithHistory(ctx: Context, productId: string): Promise<ProductWithHistory> {
  //     const exists: boolean = await this.productExists(ctx, productId);
  //     if (!exists) {
  //         throw new Error(`The product ${productId} does not exist.`);
  //     }

  //     const product = await this.readProduct(ctx, productId);
  //     const productWithHistory = new ProductWithHistory(product);
  //     productWithHistory.componentProducts = [];

  //     for (const childProductId of product.componentProductIds) {
  //         const childProduct = await this.readProduct(ctx, childProductId);
  //         productWithHistory.componentProducts.push(childProduct);
  //     }

  //     return productWithHistory;
  // }

  private async readRouteProposal(ctx: Context, routeId: string): Promise<IRouteProposal> {
    const data = await ctx.stub.getState(routeId);
    if (!data || data.length === 0) {
        throw new Error(`The route proposal ${routeId} does not exist.`);
    }
    const routeProposal = JSON.parse(data.toString()) as IRouteProposal;

    return routeProposal;
  }

  private async objectToSHA256(obj: any): Promise<string> {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(obj));
    return hash.digest('hex');
  }
  
  private async signData(data: string, privateKey: string): Promise<string> {
    const sign = createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  }

  private async verifyData(data: string, signature: string, publicKey: string): Promise<boolean> {
      const verify = createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
  }

  private omitProperty<T, K extends keyof any>(obj: T, keyToOmit: K): Omit<T, K> {
    const { [keyToOmit]: _, ...rest } = obj;
    return rest as Omit<T, K>;
  }


  // private requireField(value: string | number, fieldName: string) {
  //     if (!value) {
  //         throw new Error(`The '${fieldName}' field is required.`);
  //     }
  // }
}
