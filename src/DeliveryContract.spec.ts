import { ChaincodeStub, Iterators } from "fabric-shim";
import sinon = require("sinon");
import { SimpleJSONSerializer } from "./SimpleJSONSerializer";
import { ChaincodeFromContract } from "./lib/fabric-shim-internal";
import { DeliveryContract } from "./DeliveryContract";
import { serializers } from ".";
import { Address, Courier, RouteProposal, Stop } from "./Models";
import {
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  objectToSha256Hash,
  omitProperty,
  signObject
} from "./Utils";
import { expect } from "chai";

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
    stub.getBufferArgs.returns([Buffer.from(fnName), ...args.map(arg => SimpleJSONSerializer.serialize(arg))]);
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
    stub.getStateByRange.callsFake(
      (startKey: string, endKey: string) => {
        const result: Iterators.KV[] = [];
        for (const [key, value] of this.db) {
          if ((startKey <= key && (endKey === "" || key < endKey)) ) {
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
      }
    );

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
  it("runtime database behavior", async () => {
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
    expect(result4.map(v => v.toString())).to.be.empty
  });
});

// describe("DeliveryContract", () => {
//   // get package.json root path
//   const rootPath = process.cwd();
//   // read text from META-INF/metadata.json
//   const metadata = require(`${rootPath}/META-INF/metadata.json`);
//   const c = new ChaincodeFromContract([DeliveryContract], serializers, metadata, "title", "version");

//   // test the releaseCourier
//   it("release courier", async () => {
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var courier: Courier = {
//       hashId: "",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));
//     const stub = createStub("releaseCourier", courier);
//     expect(stub.db.size).to.equal(0);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);
//   });

//   it("release courier(2)", async () => {
//     // invalid courier with invalid hashId
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var courier: Courier = {
//       hashId: "",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     const stub = createStub("releaseCourier", courier);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The courier hashId is not valid.");
//   });

//   it("release courier(3)", async () => {
//     // invalid courier with invalid publicKey
//     var courier: Courier = {
//       hashId: "",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: "publicKey"
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));
//     const stub = createStub("releaseCourier", courier);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The public key is not valid.");
//   });

//   it("remove courier", async () => {
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var courier: Courier = {
//       hashId: "",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));
//     var stub = createStub("removeCourier", courier.hashId);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The courier " + courier.hashId + " does not exist.");

//     stub = createStub("releaseCourier", courier);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);

//     stub = updateStub(stub, "removeCourier", courier.hashId);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(0);
//   });

//   // export class Address implements HashIdObject, PublicKeyObject {
//   //     hashId!: string; // hash of the remaining fields
//   //     line1!: string;
//   //     line2!: string;
//   //     recipient!: string;
//   //     publicKey!: KeyHexString;
//   //   }

//   it("release address", async () => {
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var address = {
//       hashId: "",
//       line1: "line1",
//       line2: "line2",
//       recipient: "recipient",
//       publicKey: pk
//     };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     const stub = createStub("releaseAddress", address);
//     expect(stub.db.size).to.equal(0);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);
//   });

//   it("release address(2)", async () => {
//     // invalid address with invalid hashId
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var address = {
//       hashId: "",
//       line1: "line1",
//       line2: "line2",
//       recipient: "recipient",
//       publicKey: pk
//     };
//     const stub = createStub("releaseAddress", address);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The address hashId is not valid.");
//   });

//   it("release address(3)", async () => {
//     // invalid address with invalid publicKey
//     var address = {
//       hashId: "",
//       line1: "line1",
//       line2: "line2",
//       recipient: "recipient",
//       publicKey: "publicKey"
//     };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     const stub = createStub("releaseAddress", address);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The public key is not valid.");
//   });

//   it("remove address", async () => {
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var address = {
//       hashId: "",
//       line1: "line1",
//       line2: "line2",
//       recipient: "recipient",
//       publicKey: pk
//     };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     var stub = createStub("removeAddress", address.hashId);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The address " + address.hashId + " does not exist.");

//     stub = createStub("releaseAddress", address);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);

//     stub = updateStub(stub, "removeAddress", address.hashId);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(0);
//   });

//   it("create route proposal", async () => {
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var address: Address = { hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: pk };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     var courier: Courier = {
//       hashId: "hashId2",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));

//     // uuid need to satisfy target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
//     var testUuid = "550e8400e29b41d4a716446655440000";
//     var routeDetail: Stop = {
//       address: address.hashId,
//       expectedArrivalTimestamp: 0,
//       input: { [testUuid]: 1 },
//       output: { [testUuid]: 1 },
//       next: {
//         courier: courier.hashId,
//         info: "info",
//         destination: {
//           address: address.hashId,
//           expectedArrivalTimestamp: 10,
//           input: { [testUuid]: 1 },
//           output: { [testUuid]: 1 },
//           next: undefined
//         }
//       }
//     };

//     //route should fulfill "number of transport = number of segment object", 2add+1~2courier -> each of them 4 commit -> 1 segment
//     var commit = {
//       detail: {
//         delta: { [testUuid]: 1 },
//         info: "info",
//         timestamp: 0
//       },
//       signature: "signature"
//     };

//     var segment = {
//       srcOutgoing: commit,
//       courierReceiving: commit,
//       courierDelivering: commit,
//       dstIncoming: commit
//     };

//     var route = {
//       uuid: "550e8400e29b41d4a716446655440000",
//       goods: { [testUuid]: { uuid: testUuid, name: "name", barcode: "barcode" } },
//       addresses: { [address.hashId]: address },
//       couriers: { [courier.hashId]: courier },
//       source: routeDetail,
//       commits: [segment]
//     };
//     const stub = createStub("createRouteProposal", route);

//     const result = await c.Invoke(stub);

//     expect(result.message).to.equal("One of the commit is not empty.");
//   });

//   it("create route proposal(2)", async () => {
//     // valid route proposal
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var address: Address = { hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: pk };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     var courier: Courier = {
//       hashId: "hashId2",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));

//     // uuid need to satisfy target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
//     var testUuid = "550e8400e29b41d4a716446655440000";
//     var routeDetail: Stop = {
//       address: address.hashId,
//       expectedArrivalTimestamp: 0,
//       input: { [testUuid]: 1 },
//       output: { [testUuid]: 1 },
//       next: {
//         courier: courier.hashId,
//         info: "info",
//         destination: {
//           address: address.hashId,
//           expectedArrivalTimestamp: 10,
//           input: { [testUuid]: 1 },
//           output: { [testUuid]: 1 },
//           next: undefined
//         }
//       }
//     };

//     var segment = {
//       srcOutgoing: undefined,
//       courierReceiving: undefined,
//       courierDelivering: undefined,
//       dstIncoming: undefined
//     };

//     var route = {
//       uuid: "550e8400e29b41d4a716446655440000",
//       goods: { [testUuid]: { uuid: testUuid, name: "name", barcode: "barcode" } },
//       addresses: { [address.hashId]: address },
//       couriers: { [courier.hashId]: courier },
//       source: routeDetail,
//       commits: [segment]
//     };
//     const stub = createStub("createRouteProposal", route);
//     expect(stub.db.size).to.equal(0);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);
//   });

//   it("remove route proposal", async () => {
//     var pk = exportPublicKey(generateKeyPair().publicKey);
//     var address: Address = { hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: pk };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     var courier: Courier = {
//       hashId: "hashId2",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));

//     // uuid need to satisfy target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
//     var testUuid = "550e8400e29b41d4a716446655440000";
//     var routeDetail: Stop = {
//       address: address.hashId,
//       expectedArrivalTimestamp: 0,
//       input: { [testUuid]: 1 },
//       output: { [testUuid]: 1 },
//       next: {
//         courier: courier.hashId,
//         info: "info",
//         destination: {
//           address: address.hashId,
//           expectedArrivalTimestamp: 10,
//           input: { [testUuid]: 1 },
//           output: { [testUuid]: 1 },
//           next: undefined
//         }
//       }
//     };

//     var segment = {
//       srcOutgoing: undefined,
//       courierReceiving: undefined,
//       courierDelivering: undefined,
//       dstIncoming: undefined
//     };

//     var route = {
//       uuid: "550e8400e29b41d4a716446655440000",
//       goods: { [testUuid]: { uuid: testUuid, name: "name", barcode: "barcode" } },
//       addresses: { [address.hashId]: address },
//       couriers: { [courier.hashId]: courier },
//       source: routeDetail,
//       commits: [segment]
//     };
//     var stub = createStub("removeRouteProposal", route.uuid);
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The route proposal " + route.uuid + " does not exist.");

//     stub = updateStub(stub, "createRouteProposal", route);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);

//     stub = updateStub(stub, "removeRouteProposal", route.uuid);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(0);
//   });

//   it("sign route proposal", async () => {
//     // var Ppk = exportPublicKey(generateKeyPair().publicKey);
//     var keys = generateKeyPair();
//     var pk = exportPublicKey(keys.publicKey);
//     var sk = exportPrivateKey(keys.privateKey);
//     var address: Address = { hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: pk };
//     address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
//     var courier: Courier = {
//       hashId: "hashId2",
//       name: "name",
//       company: "company",
//       telephone: "telephone",
//       publicKey: pk
//     };
//     courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));

//     // uuid need to satisfy target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
//     var testUuid = "550e8400e29b41d4a716446655440000";
//     var routeDetail: Stop = {
//       address: address.hashId,
//       expectedArrivalTimestamp: 0,
//       input: { [testUuid]: 1 },
//       output: { [testUuid]: 1 },
//       next: {
//         courier: courier.hashId,
//         info: "info",
//         destination: {
//           address: address.hashId,
//           expectedArrivalTimestamp: 10,
//           input: { [testUuid]: 1 },
//           output: { [testUuid]: 1 },
//           next: undefined
//         }
//       }
//     };

//     var segment = {
//       srcOutgoing: undefined,
//       courierReceiving: undefined,
//       courierDelivering: undefined,
//       dstIncoming: undefined
//     };

//     var route = {
//       uuid: "550e8400e29b41d4a716446655440000",
//       goods: { [testUuid]: { uuid: testUuid, name: "name", barcode: "barcode" } },
//       addresses: { [address.hashId]: address },
//       couriers: { [courier.hashId]: courier },
//       source: routeDetail,
//       commits: [segment]
//     };
//     var stub = createStub("signRouteProposal", route.uuid, address.hashId, signObject(route, sk));
//     const actual = await c.Invoke(stub);
//     expect(actual.message).to.equal("The route proposal " + route.uuid + " does not exist.");

//     stub = updateStub(stub, "createRouteProposal", route);
//     await c.Invoke(stub);
//     expect(stub.db.size).to.equal(1);

//     // // create a irrelevant address
//     var address2: Address = {
//       hashId: "hashId2",
//       line1: "line3",
//       line2: "line4",
//       recipient: "recipient2",
//       publicKey: pk
//     };
//     address2.hashId = objectToSha256Hash(omitProperty(address2, "hashId"));
//     stub = updateStub(stub, "signRouteProposal", route.uuid);

//     // sign route proposal with irrelevant address
//     stub = updateStub(stub, "signRouteProposal", route.uuid, address2.hashId, signObject(route, sk));
//     const actual2 = await c.Invoke(stub);
//     //The entity ${entityHashId} does not exist in the route.
//     expect(actual2.message).to.equal("The entity " + address2.hashId + " does not exist in the route.");

//     //create another pair of keys, case that a approved address want to sign with malicious key
//     var keys2 = generateKeyPair();
//     var sk2 = exportPrivateKey(keys2.privateKey);
//     stub = updateStub(stub, "signRouteProposal", route.uuid, address.hashId, signObject(route, sk2));
//     const actual3 = await c.Invoke(stub);
//     expect(actual3.message).to.equal("The signature is not valid.");

//     //sign with correct key
//     const signObj = signObject(route, sk);
//     stub = updateStub(stub, "signRouteProposal", route.uuid, address.hashId, signObj);
//     await c.Invoke(stub);

//     const signedRouteProposal = SimpleJSONSerializer.deserialize(
//       await stub.getState("rp-" + route.uuid.toString())
//     ) as RouteProposal;
//     expect(Object.keys(signedRouteProposal.signatures).length).to.equal(1);
//     expect(JSON.stringify(signedRouteProposal.signatures[address.hashId])).to.equal(JSON.stringify(signObj));
//   });
// });
