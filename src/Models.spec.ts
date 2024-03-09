import { Context, Contract, Transaction } from "fabric-contract-api";

import { ChaincodeFromContract } from "./types/fabric-shim-internal";
import { ChaincodeStub } from "fabric-shim";
import sinon = require("sinon");
import { expect } from "chai";
import { IAddress, Address } from "./Models";
import { serializers } from ".";
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";

abstract class ExtendedChaincodeStub extends ChaincodeStub {
  abstract getBufferArgs(): Buffer[];
}

const certWithAttrs =
  "-----BEGIN CERTIFICATE-----" +
  "MIIB6TCCAY+gAwIBAgIUHkmY6fRP0ANTvzaBwKCkMZZPUnUwCgYIKoZIzj0EAwIw" +
  "GzEZMBcGA1UEAxMQZmFicmljLWNhLXNlcnZlcjAeFw0xNzA5MDgwMzQyMDBaFw0x" +
  "ODA5MDgwMzQyMDBaMB4xHDAaBgNVBAMTE015VGVzdFVzZXJXaXRoQXR0cnMwWTAT" +
  "BgcqhkjOPQIBBggqhkjOPQMBBwNCAATmB1r3CdWvOOP3opB3DjJnW3CnN8q1ydiR" +
  "dzmuA6A2rXKzPIltHvYbbSqISZJubsy8gVL6GYgYXNdu69RzzFF5o4GtMIGqMA4G" +
  "A1UdDwEB/wQEAwICBDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBTYKLTAvJJK08OM" +
  "VGwIhjMQpo2DrjAfBgNVHSMEGDAWgBTEs/52DeLePPx1+65VhgTwu3/2ATAiBgNV" +
  "HREEGzAZghdBbmlscy1NYWNCb29rLVByby5sb2NhbDAmBggqAwQFBgcIAQQaeyJh" +
  "dHRycyI6eyJhdHRyMSI6InZhbDEifX0wCgYIKoZIzj0EAwIDSAAwRQIhAPuEqWUp" +
  "svTTvBqLR5JeQSctJuz3zaqGRqSs2iW+QB3FAiAIP0mGWKcgSGRMMBvaqaLytBYo" +
  "9v3hRt1r8j8vN0pMcg==" +
  "-----END CERTIFICATE-----";

function createStub(fnName: string, ...args: any[]) {
  const stub = sinon.createStubInstance(ExtendedChaincodeStub);
  stub.getBufferArgs.returns([Buffer.from(fnName), ...args.map(arg => SimpleJSONSerializer.serialize(arg))]);
  stub.getTxID.returns("txId");
  stub.getChannelID.returns("channelId");
  stub.getCreator.returns({ mspid: "mspId", idBytes: Buffer.from(certWithAttrs) });
  return stub;
}

describe("Test Models Serialization", async () => {
  // get package.json root path
  const rootPath = process.cwd();
  // read text from META-INF/metadata.json
  const metadata = require(`${rootPath}/META-INF/metadata.json`);

  class TextContract extends Contract {
    @Transaction()
    public async textTransaction(ctx: Context, name: string, age: number): Promise<string> {
      return "hello " + name + " " + age;
    }

    @Transaction()
    public async sendAddress(ctx: Context, addr: Address): Promise<Address> {
      return addr;
    }
  }

  const c = new ChaincodeFromContract([TextContract], serializers, metadata, "title", "version");

  it("invoke transaction with correct primitive type parameters should return expected value", async () => {
    const stub = createStub("textTransaction", "world", 123);

    const actual = await c.Invoke(stub);

    const expected = SimpleJSONSerializer.serialize("hello world 123");

    expect(actual.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect primitive type parameters should return error", async () => {
    const stub = createStub("textTransaction", "world", "123");

    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
  });

  it("invoke transaction with incorrect type of parameters should return error", async () => {
    const stub = createStub("textTransaction", "world", "not a number");

    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
  });

  it("invoke transaction with incorrect number of parameters should return error", async () => {
    const stub = createStub("textTransaction", "world");

    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
  });

  it("invoke transaction with incorrect number of parameters should return error (2)", async () => {
    const stub = createStub("textTransaction");

    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
  });

  it("invoke transaction with correct Address model should return correct result", async () => {
    const addr: IAddress = {
      hashId: "hashId",
      line1: "line1",
      line2: "line2",
      recipient: "recipient",
      publicKey: Buffer.from("publicKey").toString("hex")
    };
    const expected = Buffer.from(JSON.stringify(addr));

    const stub = createStub("sendAddress", addr);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const addr2: IAddress = SimpleJSONSerializer.deserialize(actual.payload);   

    const stub2 = createStub("sendAddress", addr2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });
});
