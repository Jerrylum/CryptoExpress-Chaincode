import { ChaincodeStub, Iterators } from "fabric-shim";
import sinon = require("sinon");
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import { ChaincodeFromContract } from "./lib/fabric-shim-internal";
import { DeliveryContract } from "./DeliveryContract";
import { serializers } from ".";
import { Address, Commit, Courier, Route, RouteProposal } from "./Models";
import { createHashIdObject, exportPrivateKey, exportPublicKey, generateKeyPair, signObject } from "./Utils";
import { expect } from "chai";
import { getMetadataJson } from "./index.spec";

abstract class ExtendedChaincodeStub extends ChaincodeStub {
  // abstract db: Map<string, Uint8Array>;
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

class TestRuntime {
  db: Map<string, Uint8Array> = new Map<string, Uint8Array>();

  createStub(fnName: string, ...args: any[]) {
    const stub = sinon.createStubInstance(ExtendedChaincodeStub);
    stub.getBufferArgs.returns([
      Buffer.from(fnName),
      ...(args.map(arg => SimpleJSONSerializer.serialize(arg)).filter(arg => arg !== undefined) as Buffer[])
    ]);
    stub.getTxID.returns("txId");
    stub.getChannelID.returns("channelId");
    stub.getCreator.returns({ mspid: "mspId", idBytes: Buffer.from(certWithAttrs) });
    stub.putState.callsFake(async (key: string, value: Uint8Array) => {
      this.db.set(key, value);
    });
    stub.getState.callsFake(async (key: string) => {
      return this.db.get(key) || Uint8Array.from([]);
    });
    stub.deleteState.callsFake(async (key: string) => {
      this.db.delete(key);
    });
    stub.getStateByRange.callsFake((startKey: string, endKey: string) => {
      const result: Iterators.KV[] = [];
      for (const [key, value] of this.db) {
        if (startKey <= key && (endKey === "" || key < endKey)) {
          result.push({ namespace: "", key, value });
        }
      }

      let idx = 0;

      const promise = new Promise<Iterators.StateQueryIterator>(resolve => {
        resolve({
          close: async () => {},
          next: async () => {
            if (idx >= result.length) {
              return { done: true, value: undefined as any };
            } else {
              return { done: false, value: result[idx++] };
            }
          }
        });
      }) as Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
      promise[Symbol.asyncIterator] = () => {
        let iterator: Iterators.StateQueryIterator;
        return {
          next: async (): Promise<IteratorResult<Iterators.KV, any>> => {
            if (!iterator) {
              const response = await promise;
              iterator = response;
            }

            const nextVal = await iterator.next();
            if (nextVal.done) {
              await iterator.close();
            }

            return nextVal;
          },
          return: async () => {
            await iterator.close();
            return { done: true, value: undefined };
          }
        };
      };
      return promise;
    });

    return stub;
  }
}

async function readIterator(iterator: Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>) {
  const result: Uint8Array[] = [];
  for await (const res of iterator) {
    result.push(res.value);
  }
  return result;
}

describe("TestRuntime", () => {
  it("CRUD should be successful", async () => {
    const rt = new TestRuntime();

    rt.createStub("test").putState("hello", Buffer.from("world"));
    const value = (await rt.createStub("test").getState("hello")).toString();
    expect(value).to.equal("world");

    rt.createStub("test").putState("hello", Buffer.from("my world"));
    const value2 = (await rt.createStub("test").getState("hello")).toString();
    expect(value2).to.equal("my world");

    const value3 = (await rt.createStub("test").getState("not exist")).toString();
    expect(value3).to.equal("");

    rt.createStub("test").putState("kt-1", Buffer.from("data1"));
    rt.createStub("test").putState("kt-2", Buffer.from("data2"));
    rt.createStub("test").putState("kt-3", Buffer.from("data3"));
    const result = await readIterator(rt.createStub("test").getStateByRange("kt-1", "kt-3"));
    expect(result.map(v => v.toString())).to.deep.equal(["data1", "data2"]);

    const result2 = await readIterator(rt.createStub("test").getStateByRange("kt-", "kt."));
    expect(result2.map(v => v.toString())).to.deep.equal(["data1", "data2", "data3"]);

    const result3 = await readIterator(rt.createStub("test").getStateByRange("", ""));
    expect(result3.map(v => v.toString())).to.deep.equal(["my world", "data1", "data2", "data3"]);

    const result4 = await readIterator(rt.createStub("test").getStateByRange("no", "no"));
    expect(result4.map(v => v.toString())).to.be.empty;

    rt.createStub("test").deleteState("hello");
    const value4 = (await rt.createStub("test").getState("hello")).toString();
    expect(value4).to.equal("");

    rt.createStub("test").deleteState("hello");
    const value5 = (await rt.createStub("test").getState("hello")).toString();
    expect(value5).to.equal("");
  });
});

describe("DeliveryContract", () => {
  const metadata = getMetadataJson();

  const c = new ChaincodeFromContract([DeliveryContract], serializers, metadata, "title", "version");

  it("CRD Address: releaseAddress & removeAddress", async () => {
    const rt = new TestRuntime();

    let address: Address = createHashIdObject({
      line1: "my line1",
      line2: "my line2",
      recipient: "my recipient",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });

    // remove a non-exist address
    const result4 = await c.Invoke(rt.createStub("removeAddress", address.hashId));
    expect(result4.message).to.equal(`The address ${address.hashId} does not exist.`);

    // Create with invalid hash id
    address.hashId = "invalid hash id";
    const result0 = await c.Invoke(rt.createStub("releaseAddress", address));
    expect(result0.message).to.equal(`The address hashId is not valid.`);

    // Create with invalid public key
    address = createHashIdObject({
      line1: "my line1",
      line2: "my line2",
      recipient: "my recipient",
      publicKey: "invalid public key"
    });
    const result7 = await c.Invoke(rt.createStub("releaseAddress", address));
    expect(result7.message).to.equal(`The public key is not valid.`);

    // Create
    address = createHashIdObject({
      line1: "my line1",
      line2: "my line2",
      recipient: "my recipient",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });
    const result8 = await c.Invoke(rt.createStub("releaseAddress", address));
    expect(result8.status).to.equal(200);

    // Read
    const result2 = await c.Invoke(rt.createStub("getData", "ad", address.hashId));
    expect(result2.payload).to.deep.equal(SimpleJSONSerializer.serialize(address));

    // Delete
    const result5 = await c.Invoke(rt.createStub("removeAddress", address.hashId));
    expect(result5.status).to.equal(200);

    // Read
    const result6 = await c.Invoke(rt.createStub("getData", "ad", address.hashId));
    expect(result6.payload).to.be.empty;
  });

  it("CRD Courier: releaseCourier & removeCourier", async () => {
    const rt = new TestRuntime();

    let courier: Courier = createHashIdObject({
      name: "my name",
      company: "my company",
      telephone: "my telephone",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });

    // Create with invalid hash id
    courier.hashId = "invalid hash id";
    const result0 = await c.Invoke(rt.createStub("releaseCourier", courier));
    expect(result0.message).to.equal(`The courier hashId is not valid.`);

    // Create with invalid public key
    courier = createHashIdObject({
      name: "my name",
      company: "my company",
      telephone: "my telephone",
      publicKey: "invalid public key"
    });
    const result = await c.Invoke(rt.createStub("releaseCourier", courier));
    expect(result.message).to.equal(`The public key is not valid.`);

    // Remove a non-exist courier
    const result7 = await c.Invoke(rt.createStub("removeCourier", courier.hashId));
    expect(result7.message).to.equal(`The courier ${courier.hashId} does not exist.`);

    // Create
    courier = createHashIdObject({
      name: "my name",
      company: "my company",
      telephone: "my telephone",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });
    const result1 = await c.Invoke(rt.createStub("releaseCourier", courier));
    expect(result1.status).to.equal(200);

    // Read
    const result2 = await c.Invoke(rt.createStub("getData", "cr", courier.hashId));
    expect(result2.payload).to.deep.equal(SimpleJSONSerializer.serialize(courier));

    // Delete
    const result5 = await c.Invoke(rt.createStub("removeCourier", courier.hashId));
    expect(result5.status).to.equal(200);

    // Read
    const result6 = await c.Invoke(rt.createStub("getData", "cr", courier.hashId));
    expect(result6.payload).to.be.empty;
  });

  it("CRUD Route Proposal: createRouteProposal", async () => {
    const rt = new TestRuntime();

    const uuid = "550e8400e29b41d4a716446655440000";
    const good1 = { uuid: "uuid000000000001", name: "name1", barcode: "barcode1" };
    const good2 = { uuid: "uuid000000000002", name: "name2", barcode: "barcode2" };

    const addrA: Address = createHashIdObject({
      line1: "my line1 A",
      line2: "my line2 A",
      recipient: "my recipient A",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });

    const addrB: Address = createHashIdObject({
      line1: "my line1 B",
      line2: "my line2 B",
      recipient: "my recipient B",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });

    const courier: Courier = createHashIdObject({
      name: "my name",
      company: "my company",
      telephone: "my telephone",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });

    const route = {
      uuid,
      goods: { [good1.uuid]: good1, [good2.uuid]: good2 },
      addresses: { [addrA.hashId]: addrA, [addrB.hashId]: addrB },
      couriers: { [courier.hashId]: courier },
      source: {
        address: addrA.hashId,
        expectedArrivalTimestamp: 0,
        input: {},
        output: { [good1.uuid]: 1, [good2.uuid]: 1 },
        next: {
          courier: courier.hashId,
          info: "info",
          destination: {
            address: addrB.hashId,
            expectedArrivalTimestamp: 10,
            input: { [good1.uuid]: 1, [good2.uuid]: 1 },
            output: {}
            // next: undefined
          }
        }
      },
      commits: [{}]
    } as Route;

    // Create
    const result = await c.Invoke(rt.createStub("createRouteProposal", route));
    expect(result.status).to.equal(200);

    // Read
    const result2 = await c.Invoke(rt.createStub("getData", "rp", uuid));
    expect(result2.payload).to.deep.equal(SimpleJSONSerializer.serialize({ route, signatures: {} }));

    // Update
    good2.name = "name2 - new";

    const result3 = await c.Invoke(rt.createStub("createRouteProposal", route));
    expect(result3.status).to.equal(200);

    // Read
    const result4 = await c.Invoke(rt.createStub("getData", "rp", uuid));
    expect(result4.payload).to.deep.equal(SimpleJSONSerializer.serialize({ route, signatures: {} }));

    // Delete
    const result5 = await c.Invoke(rt.createStub("removeRouteProposal", uuid));
    expect(result5.status).to.equal(200);

    // Delete non-exist route
    const result9 = await c.Invoke(rt.createStub("removeRouteProposal", "123123"));
    expect(result9.message).to.equal(`The route proposal 123123 does not exist.`);

    // Read
    const result6 = await c.Invoke(rt.createStub("getData", "rp", uuid));
    expect(result6.payload).to.be.empty;

    // Create fail
    route.commits[0].srcOutgoing = {
      detail: {
        delta: { [good1.uuid]: 1 },
        info: "info",
        timestamp: 0
      },
      signature: "signature"
    };

    const result7 = await c.Invoke(rt.createStub("createRouteProposal", route));
    expect(result7.message).to.equal("One of the commit is not empty.");

    // validateRoute handled all fail cases. See Utils.spec.ts
  });

  it("RouteProposal life cycle: createRouteProposal -> signRouteProposal -> submitRouteProposal", async () => {
    const rt = new TestRuntime();

    const uuid = "550e8400e29b41d4a716446655440000";
    const good1 = { uuid: "uuid000000000001", name: "name1", barcode: "barcode1" };
    const good2 = { uuid: "uuid000000000002", name: "name2", barcode: "barcode2" };

    const keyPairA = generateKeyPair();
    const addrA: Address = createHashIdObject({
      line1: "my line1 A",
      line2: "my line2 A",
      recipient: "my recipient A",
      publicKey: exportPublicKey(keyPairA.publicKey)
    });

    const keyPairB = generateKeyPair();
    const addrB: Address = createHashIdObject({
      line1: "my line1 B",
      line2: "my line2 B",
      recipient: "my recipient B",
      publicKey: exportPublicKey(keyPairB.publicKey)
    });

    const keyPairC = generateKeyPair();
    const courier: Courier = createHashIdObject({
      name: "my name",
      company: "my company",
      telephone: "my telephone",
      publicKey: exportPublicKey(keyPairC.publicKey)
    });

    const route = {
      uuid,
      goods: { [good1.uuid]: good1, [good2.uuid]: good2 },
      addresses: { [addrA.hashId]: addrA, [addrB.hashId]: addrB },
      couriers: { [courier.hashId]: courier },
      source: {
        address: addrA.hashId,
        expectedArrivalTimestamp: 0,
        input: {},
        output: { [good1.uuid]: 1, [good2.uuid]: 1 },
        next: {
          courier: courier.hashId,
          info: "info",
          destination: {
            address: addrB.hashId,
            expectedArrivalTimestamp: 10,
            input: { [good1.uuid]: 1, [good2.uuid]: 1 },
            output: {}
            // next: undefined
          }
        }
      },
      commits: [{}]
    } as Route;

    // Create
    const result = await c.Invoke(rt.createStub("createRouteProposal", route));
    expect(result.status).to.equal(200);

    const proposal: RouteProposal = SimpleJSONSerializer.deserialize(result.payload);
    expect(proposal.route).to.deep.equal(route);

    // Try to sign as a non-exist address
    const signTest = signObject(route, exportPrivateKey(keyPairA.privateKey));
    const result0 = await c.Invoke(rt.createStub("signRouteProposal", uuid, "non-exist", signTest));
    expect(result0.message).to.equal(`The entity non-exist does not exist in the route.`);

    // Try to sign with a invalid signature
    const result1 = await c.Invoke(rt.createStub("signRouteProposal", uuid, addrA.hashId, "invalid signature"));
    expect(result1.message).to.equal(`The signature is not valid.`);

    // Sign
    const signA = signObject(route, exportPrivateKey(keyPairA.privateKey));
    const result2 = await c.Invoke(rt.createStub("signRouteProposal", uuid, addrA.hashId, signA));
    expect(result2.status).to.equal(200);

    proposal.signatures[addrA.hashId] = signA;
    const proposal2: RouteProposal = SimpleJSONSerializer.deserialize(result2.payload);
    expect(proposal2).to.deep.equal(proposal);

    // Clear the signature
    good2.name = "name2 - new";
    const result3 = await c.Invoke(rt.createStub("createRouteProposal", route));
    expect(result3.status).to.equal(200);

    const proposal3: RouteProposal = SimpleJSONSerializer.deserialize(result3.payload);
    expect(proposal3.signatures).to.be.empty;

    // Sign 2 times
    const signA2 = signObject(route, exportPrivateKey(keyPairA.privateKey));
    const result4 = await c.Invoke(rt.createStub("signRouteProposal", uuid, addrA.hashId, signA2));
    expect(result4.status).to.equal(200);

    // Sign 2 times
    const signB = signObject(route, exportPrivateKey(keyPairB.privateKey));
    const result5 = await c.Invoke(rt.createStub("signRouteProposal", uuid, addrB.hashId, signB));
    expect(result5.status).to.equal(200);

    const signB2 = signObject(route, exportPrivateKey(keyPairB.privateKey));
    const result6 = await c.Invoke(rt.createStub("signRouteProposal", uuid, addrB.hashId, signB2));
    expect(result6.message).to.equal(`The entity ${addrB.hashId} has already signed the route proposal.`);

    // Submit fail
    const result7 = await c.Invoke(rt.createStub("submitRouteProposal", uuid));
    expect(result7.message).to.equal(`The route proposal is not fully signed.`);

    // Sign
    const signC = signObject(route, exportPrivateKey(keyPairC.privateKey));
    const result8 = await c.Invoke(rt.createStub("signRouteProposal", uuid, courier.hashId, signC));
    expect(result8.status).to.equal(200);

    // Submit
    const result9 = await c.Invoke(rt.createStub("submitRouteProposal", uuid));
    expect(result9.status).to.equal(200);

    // Read
    const result10 = await c.Invoke(rt.createStub("getData", "rp", uuid));
    expect(result10.payload).to.be.empty;

    // Read
    const result11 = await c.Invoke(rt.createStub("getData", "rt", uuid));
    expect(result11.payload).to.deep.equal(SimpleJSONSerializer.serialize(route));

    // Sign non-exist route
    const signC2 = signObject(route, exportPrivateKey(keyPairC.privateKey));
    const result12 = await c.Invoke(rt.createStub("signRouteProposal", "non-exist", courier.hashId, signC2));
    expect(result12.message).to.equal(`The route proposal non-exist does not exist.`);

    // Submit non-exist route
    const result13 = await c.Invoke(rt.createStub("submitRouteProposal", "non-exist"));
    expect(result13.message).to.equal(`The route proposal non-exist does not exist.`);
  });

  it("Route life cycle: commitProgress", async () => {
    // create a valid route object with 1 segment
    const rt = new TestRuntime();

    const uuid = "550e8400e29b41d4a716446655440000";
    const good1 = { uuid: "uuid000000000001", name: "name1", barcode: "barcode1" };
    const good2 = { uuid: "uuid000000000002", name: "name2", barcode: "barcode2" };

    const keyPairA = generateKeyPair();
    const addrA: Address = createHashIdObject({
      line1: "my line1 A",
      line2: "my line2 A",
      recipient: "my recipient A",
      publicKey: exportPublicKey(keyPairA.publicKey)
    });

    const keyPairB = generateKeyPair();
    const addrB: Address = createHashIdObject({
      line1: "my line1 B",
      line2: "my line2 B",
      recipient: "my recipient B",
      publicKey: exportPublicKey(keyPairB.publicKey)
    });

    const keyPairC = generateKeyPair();
    const courier: Courier = createHashIdObject({
      name: "my name",
      company: "my company",
      telephone: "my telephone",
      publicKey: exportPublicKey(keyPairC.publicKey)
    });

    const route = {
      uuid,
      goods: { [good1.uuid]: good1, [good2.uuid]: good2 },
      addresses: { [addrA.hashId]: addrA, [addrB.hashId]: addrB },
      couriers: { [courier.hashId]: courier },
      source: {
        address: addrA.hashId,
        expectedArrivalTimestamp: 0,
        input: {},
        output: { [good1.uuid]: 1, [good2.uuid]: 1 },
        next: {
          courier: courier.hashId,
          info: "info",
          destination: {
            address: addrB.hashId,
            expectedArrivalTimestamp: 10,
            input: { [good1.uuid]: 1, [good2.uuid]: 1 },
            output: {}
            // next: undefined
          }
        }
      },
      commits: [{}]
    } as Route;

    const commit: Commit = {
      detail: {
        delta: { [good1.uuid]: 1 },
        info: "info",
        timestamp: 0
      },
      signature: "random invalid signature"
    };

    // Try to commit before put in the state db
    const result = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "srcOutgoing", commit));
    expect(result.message).to.equal(`The route ${route.uuid} does not exist.`);

    // Mock a submitted route
    rt.db.set(`rt-${route.uuid}`, SimpleJSONSerializer.serialize(route));

    // Try to commit on a invalid segment index
    const result3 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 1, "srcOutgoing", commit));
    expect(result3.message).to.equal(`The segment index 1 is not valid.`);

    const result4 = await c.Invoke(rt.createStub("commitProgress", route.uuid, -1, "srcOutgoing", commit));
    expect(result4.message).to.equal(`The segment index -1 is not valid.`);

    // Try to commit on a invalid commit name
    const result5 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "notExist", commit));
    expect(result5.message).to.equal(`The step notExist is not valid.`);

    // Commit that is not within the range of 60 seconds
    const result6 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "srcOutgoing", commit));
    expect(result6.message).to.equal(`The commit timestamp is not within one minute.`);

    commit.detail.timestamp = Date.now() / 1000;
    // Commit that has invalid signature
    const result7 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "srcOutgoing", commit));
    expect(result7.message).to.equal(`The commit signature is not valid.`);

    // Commit success
    commit.signature = signObject(commit.detail, exportPrivateKey(keyPairA.privateKey));
    const result8 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "srcOutgoing", commit));
    expect(result8.status).to.equal(200);

    // Commit twice
    const result9 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "srcOutgoing", commit));
    expect(result9.message).to.equal(`The current moment is already committed.`);

    // Commit on a future segment
    const result10 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "courierDelivering", commit));
    expect(result10.message).to.equal(`The previous moment is not committed.`);

    // invalid timestamp segment
    commit.detail.timestamp = -1;
    const result11 = await c.Invoke(rt.createStub("commitProgress", route.uuid, 0, "courierReceiving", commit));
    expect(result11.message).to.equal(`The commit is not in the correct order.`);
  });

  it("getData should return expected data", async () => {
    const rt = new TestRuntime();

    // mock the db in rt to have map as the 4 types of data
    const address: Address = createHashIdObject({
      line1: "my line1",
      line2: "my line2",
      recipient: "my recipient",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });
    rt.db.set(`ad-${address.hashId}`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`cr-${address.hashId}`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`rp-${address.hashId}`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`rt-${address.hashId}`, SimpleJSONSerializer.serialize(address));

    // get specific data of prefix 'ad'
    const result = await c.Invoke(rt.createStub("getData", "ad", address.hashId));
    expect(result.payload).to.deep.equal(SimpleJSONSerializer.serialize(address));

    // get specific data of prefix 'cr'
    const result2 = await c.Invoke(rt.createStub("getData", "cr", address.hashId));
    expect(result2.payload).to.deep.equal(SimpleJSONSerializer.serialize(address));

    // get specific data of prefix 'rp'
    const result3 = await c.Invoke(rt.createStub("getData", "rp", address.hashId));
    expect(result3.payload).to.deep.equal(SimpleJSONSerializer.serialize(address));

    // get specific data of prefix 'rt'
    const result4 = await c.Invoke(rt.createStub("getData", "rt", address.hashId));
    expect(result4.payload).to.deep.equal(SimpleJSONSerializer.serialize(address));

    // invalid prefix
    const result5 = await c.Invoke(rt.createStub("getData", "invalid", address.hashId));
    expect(result5.message).to.equal(`The prefix invalid is not valid.`);
  });

  it("getAllData should returns all data", async () => {
    const rt = new TestRuntime();

    // mock the db in rt to have map as the 4 types of data, each type with 2 data
    const address: Address = createHashIdObject({
      line1: "my line1",
      line2: "my line2",
      recipient: "my recipient",
      publicKey: exportPublicKey(generateKeyPair().publicKey)
    });
    rt.db.set(`ad-${address.hashId}1`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`ad-${address.hashId}2`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`cr-${address.hashId}1`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`cr-${address.hashId}2`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`rp-${address.hashId}1`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`rp-${address.hashId}2`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`rt-${address.hashId}1`, SimpleJSONSerializer.serialize(address));
    rt.db.set(`rt-${address.hashId}2`, SimpleJSONSerializer.serialize(address));

    // get all data of prefix 'ad'
    const result = await c.Invoke(rt.createStub("getAllData", "ad"));
    expect(result.payload).to.deep.equal(SimpleJSONSerializer.serialize([address, address]));

    // get all data of prefix 'cr'
    const result2 = await c.Invoke(rt.createStub("getAllData", "cr"));
    expect(result2.payload).to.deep.equal(SimpleJSONSerializer.serialize([address, address]));

    // get all data of prefix 'rp'
    const result3 = await c.Invoke(rt.createStub("getAllData", "rp"));
    expect(result3.payload).to.deep.equal(SimpleJSONSerializer.serialize([address, address]));

    // get all data of prefix 'rt'
    const result4 = await c.Invoke(rt.createStub("getAllData", "rt"));
    expect(result4.payload).to.deep.equal(SimpleJSONSerializer.serialize([address, address]));

    // invalid prefix
    const result5 = await c.Invoke(rt.createStub("getAllData", "invalid"));
    expect(result5.message).to.equal(`The prefix invalid is not valid.`);
  });
});
