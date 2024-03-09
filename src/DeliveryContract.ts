// export {}

/*
 * SPDX-License-Identifier: Apache-2.0
 */



import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import { Buffer } from "buffer";
import { generateKeyPairSync, createSign, createVerify, createHash } from "node:crypto";
import { IRouteProposal, IAddress, ICourier } from "./Models";

// state standards
// ctx.stub.putState("rp-uuid", Buffer.from("{ }")); // route proposal
// ctx.stub.putState("ad-hashId", Buffer.from("{ }")); // address
// ctx.stub.putState("cr-hashId", Buffer.from("{ }")); // courier
// ctx.stub.putState("gs-uuid", Buffer.from("{ }")); // goods
// ctx.stub.getStateByRange("rp-", "rp-"); // get all route proposals

@Info({ title: "DeliveryChain", description: "Smart Contract for handling delivery chain." })
export class DeliveryContract extends Contract {
  @Transaction(false)
  @Returns("boolean")
  public async routeExists(ctx: Context, routeUuid: string): Promise<boolean> {
    const data = await ctx.stub.getState("rp-"+routeUuid);
    return !!data && data.length > 0;
  }

  @Transaction(false)
  @Returns("boolean")
  public async addressExists(ctx: Context, hashId: string): Promise<boolean> {
    const data = await ctx.stub.getState("ad-"+hashId);
    return !!data && data.length > 0;
  }

  @Transaction(false)
  @Returns("boolean")
  public async courierExists(ctx: Context, hashId: string): Promise<boolean> {
    const data = await ctx.stub.getState("cr-"+hashId);
    return !!data && data.length > 0;
  }

  @Transaction(false)
  @Returns("boolean")
  public async goodsExists(ctx: Context, goodsUuid: string): Promise<boolean> {
    const data = await ctx.stub.getState("gs-"+goodsUuid);
    return !!data && data.length > 0;
  }

  @Transaction()
  public async createRouteProposal(ctx: Context, routeProposalJsonStr: string): Promise<void> {
    const routeProposal = JSON.parse(routeProposalJsonStr) as IRouteProposal;

    const exists: boolean = await this.routeExists(ctx, routeProposal.route.uuid);
    if (exists) {
        throw new Error(`The route proposal ${routeProposal.route.uuid} already exists.`);
    }
    //check the address book and courier book
    if (!await this.validateAddressCourierHash(routeProposal.route.addresses)) {
      throw new Error(`The address hash is not valid.`);
    }
    if (!await this.validateAddressCourierHash(routeProposal.route.couriers)) {
      throw new Error(`The courier hash is not valid.`);
    }
    const buffer = Buffer.from(JSON.stringify(routeProposal));
    await ctx.stub.putState("rp-"+routeProposal.route.uuid, buffer);
  }
  
  @Transaction()
  public async signRouteProposal(ctx: Context, routeId: string, unsignedData: string, sign: string): Promise<void> {
    // unsignedData is the data to be signed for the local user, for courier, it is the Json stringified ICourier(without hashID), for address, it is the Json stringified IAddress(without hashID)
    const routeProposal = await this.readRouteProposal(ctx, routeId);
    // for each key in routeProposal.signatures
    const addressBook = routeProposal.route.addresses;
    const courierBook = routeProposal.route.couriers;
    if (!await this.validateAddressCourierHash(routeProposal.route.addresses)) {
      throw new Error(`The address hash is not valid.`);
    }
    if (!await this.validateAddressCourierHash(routeProposal.route.couriers)) {
      throw new Error(`The courier hash is not valid.`);
    }
    if (!await this.validateRouteProposalSignatures(routeProposal)) {
      throw new Error(`The route proposal signature is not valid.`);
    }
    routeProposal.signatures[await this.objectToSHA256(unsignedData)] = sign;
    const buffer = Buffer.from(JSON.stringify(routeProposal));
    await ctx.stub.putState("rp-"+routeId, buffer);
  }

  @Transaction(false)
  @Returns("IRouteProposal")
  private async readRouteProposal(ctx: Context, routeId: string): Promise<IRouteProposal> {
    const data = await ctx.stub.getState(routeId);
    if (!data || data.length === 0) {
        throw new Error(`The route proposal ${routeId} does not exist.`);
    }
    const routeProposal = JSON.parse(data.toString()) as IRouteProposal;

    return routeProposal;
  }

  // 2 functions for create a new address, update an existing address
  @Transaction()
  public async createAddress(ctx: Context, addressJsonStr: string): Promise<void> {
    const address = JSON.parse(addressJsonStr) as IAddress;
    // check the address value on "hashId", "line1", "line2", "recipient", "publicKey"
    // if the value is not valid, throw an error
    if (address.hashId === undefined || address.line1 === undefined || address.line2 === undefined || address.recipient === undefined || address.publicKey === undefined) {
      throw new Error(`The address ${address.hashId} is not valid.`);
    }
    // check the address hash
    if (address.hashId !== await this.objectToSHA256(address)) {
      throw new Error(`The address ${address.hashId} is not valid.`);
    }
    const exists: boolean = await this.addressExists(ctx, address.hashId);
    if (exists) {
        throw new Error(`The address ${address.hashId} already exists.`);
    }
    const buffer = Buffer.from(JSON.stringify(address));
    await ctx.stub.putState("ad-"+address.hashId, buffer);
  }
  
  @Transaction()
  public async updateAddress(ctx: Context, addressJsonStr: string): Promise<void> {
    const address = JSON.parse(addressJsonStr) as IAddress;
    // check the address value on "hashId", "line1", "line2", "recipient", "publicKey"
    // if the value is not valid, throw an error
    if (address.hashId === undefined || address.line1 === undefined || address.line2 === undefined || address.recipient === undefined || address.publicKey === undefined) {
      throw new Error(`The address ${address.hashId} is not valid.`);
    }
    // check the address hash
    if (address.hashId !== await this.objectToSHA256(address)) {
      throw new Error(`The address ${address.hashId} is not valid.`);
    }
    const exists: boolean = await this.addressExists(ctx, address.hashId);
    if (!exists) {
        throw new Error(`The address ${address.hashId} does not exist.`);
    }
    const buffer = Buffer.from(JSON.stringify(address));
    await ctx.stub.putState("ad-"+address.hashId, buffer);
  }

  // 2 functions for create a new courier, update an existing courier
  @Transaction()
  public async createCourier(ctx: Context, courierJsonStr: string): Promise<void> {
    const courier = JSON.parse(courierJsonStr) as ICourier;
    // check the courier value on "hashId", "name", "company", "telephone", "publicKey"
    // if the value is not valid, throw an error
    if (courier.hashId === undefined || courier.name === undefined || courier.company === undefined || courier.telephone === undefined || courier.publicKey === undefined) {
      throw new Error(`The courier ${courier.hashId} is not valid.`);
    }
    // check the courier hash
    if (courier.hashId !== await this.objectToSHA256(courier)) {
      throw new Error(`The courier ${courier.hashId} is not valid.`);
    }
    const exists: boolean = await this.courierExists(ctx, courier.hashId);
    if (exists) {
        throw new Error(`The courier ${courier.hashId} already exists.`);
    }
    const buffer = Buffer.from(JSON.stringify(courier));
    await ctx.stub.putState("cr-"+courier.hashId, buffer);
  }

  @Transaction()
  public async updateCourier(ctx: Context, courierJsonStr: string): Promise<void> {
    const courier = JSON.parse(courierJsonStr) as ICourier;
    // check the courier value on "hashId", "name", "company", "telephone", "publicKey"
    // if the value is not valid, throw an error
    if (courier.hashId === undefined || courier.name === undefined || courier.company === undefined || courier.telephone === undefined || courier.publicKey === undefined) {
      throw new Error(`The courier ${courier.hashId} is not valid.`);
    }
    // check the courier hash
    if (courier.hashId !== await this.objectToSHA256(courier)) {
      throw new Error(`The courier ${courier.hashId} is not valid.`);
    }
    const exists: boolean = await this.courierExists(ctx, courier.hashId);
    if (!exists) {
        throw new Error(`The courier ${courier.hashId} does not exist.`);
    }
    const buffer = Buffer.from(JSON.stringify(courier));
    await ctx.stub.putState("cr-"+courier.hashId, buffer);
  }

  // 2 functions for create a new goods, update an existing goods
  @Transaction()
  public async createGoods(ctx: Context, goodsJsonStr: string): Promise<void> {
    const goods = JSON.parse(goodsJsonStr) as any;
    // check the goods value on "uuid", "name", "barcode"
    // if the value is not valid, throw an error
    if (goods.uuid === undefined || goods.name === undefined || goods.barcode === undefined) {
      throw new Error(`The goods ${goods.uuid} is not valid.`);
    }
    const exists: boolean = await this.goodsExists(ctx, goods.uuid);
    if (exists) {
        throw new Error(`The goods ${goods.uuid} already exists.`);
    }
    const buffer = Buffer.from(JSON.stringify(goods));
    await ctx.stub.putState("gs-"+goods.uuid, buffer);
  }

  @Transaction()
  public async updateGoods(ctx: Context, goodsJsonStr: string): Promise<void> {
    const goods = JSON.parse(goodsJsonStr) as any;
    // check the goods value on "uuid", "name", "barcode"
    // if the value is not valid, throw an error
    if (goods.uuid === undefined || goods.name === undefined || goods.barcode === undefined) {
      throw new Error(`The goods ${goods.uuid} is not valid.`);
    }
    const exists: boolean = await this.goodsExists(ctx, goods.uuid);
    if (!exists) {
        throw new Error(`The goods ${goods.uuid} does not exist.`);
    }
    const buffer = Buffer.from(JSON.stringify(goods));
    await ctx.stub.putState("gs-"+goods.uuid, buffer);
  }

  @Transaction(false)
  private async objectToSHA256(obj: any): Promise<string> {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(obj));
    return hash.digest('hex');
  }

  @Transaction(false)
  @Returns("boolean")
  private async validateAddressCourierHash(addresses: { [HashId: string]: IAddress | ICourier }): Promise<boolean> {
    // for each key (hashId) in addresses
    // use omitProperty to omit a object that from IAddress/ICourier which exclude the attribute of hashId
    // use objectToSHA256 to hash the object, compare the hash with the hashId
    // if the hash is not equal to the hashId, return false
    // if the hash is equal to the hashId, continue to the next key
    for (const key in Object.keys(addresses)) {
      const address = addresses[key];
      const hash = await this.objectToSHA256(this.omitProperty(address, 'hashId'));
      if (hash !== key) {
        return false;
      }
    }
    return true;
  }

  @Transaction(false)
  @Returns("boolean")
  private async validateRouteProposalSignatures(routeProposal: IRouteProposal): Promise<boolean> {
    var pk = undefined;
    const addressBook = routeProposal.route.addresses;
    const courierBook = routeProposal.route.couriers;
    for(const key in Object.keys(routeProposal.signatures)) {
      if (Object.keys(addressBook).includes(key)) {
        pk = addressBook[key].publicKey;
      }else if (Object.keys(courierBook).includes(key)) {
        pk = courierBook[key].publicKey;
      }
      // irrelevant signature exists
      if (pk === undefined) { 
        continue;
      }
      const data = JSON.stringify(routeProposal.route);
      const signedData = routeProposal.signatures[key];
      if (!await this.verifyData(data, signedData, pk)) {
        return false;
      }
      pk = undefined;
    }
    return true;
  }
  
  @Transaction(false)
  @Returns("string")
  private async signData(data: string, privateKey: string): Promise<string> {
    const sign = createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  }

  @Transaction(false)
  @Returns("boolean")
  private async verifyData(data: string, signature: string, publicKey: string): Promise<boolean> {
      const verify = createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
  }

  @Transaction(false)
  private omitProperty<T, K extends keyof any>(obj: T, keyToOmit: K): Omit<T, K> {
    const { [keyToOmit]: _, ...rest } = obj;
    return rest as Omit<T, K>;
  }
}
