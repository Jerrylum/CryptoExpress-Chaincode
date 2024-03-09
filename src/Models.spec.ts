import { Context, Contract, Transaction } from "fabric-contract-api";

import { ChaincodeFromContract } from "./lib/fabric-shim-internal";
import { ChaincodeStub } from "fabric-shim";
import sinon = require("sinon");
import { expect } from "chai";
import {
  IAddress,
  Address,
  ICourier,
  Courier,
  IGood,
  Good,
  IStop,
  Stop,
  ITransport,
  Transport,
  ICommitDetail,
  CommitDetail,
  ICommit,
  Commit,
  ISegment,
  Segment,
  IRoute,
  Route,
  IRouteProposal,
  RouteProposal
} from "./Models";
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

    @Transaction()
    public async sendCourier(ctx: Context, courier: Courier): Promise<Courier> {
      return courier;
    }

    @Transaction()
    public async sendGood(ctx: Context, good: Good): Promise<Good> {
      return good;
    }

    @Transaction()
    public async sendStop(ctx: Context, stop: Stop): Promise<Stop> {
      return stop;
    }

    @Transaction()
    public async sendTransport(ctx: Context, transport: Transport): Promise<Transport> {
      return transport;
    }

    @Transaction()
    public async sendCommitDetail(ctx: Context, commitDetail: CommitDetail): Promise<CommitDetail> {
      return commitDetail;
    }

    @Transaction()
    public async sendCommit(ctx: Context, commit: Commit): Promise<Commit> {
      return commit;
    }

    @Transaction()
    public async sendSegment(ctx: Context, segment: Segment): Promise<Segment> {
      return segment;
    }

    @Transaction()
    public async sendRoute(ctx: Context, route: Route): Promise<Route> {
      return route;
    }

    @Transaction()
    public async sendRouteProposal(ctx: Context, routeProposal: RouteProposal): Promise<RouteProposal> {
      return routeProposal;
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
    const expected = SimpleJSONSerializer.serialize(addr);

    const stub = createStub("sendAddress", addr);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const addr2: IAddress = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendAddress", addr2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Address model should return error", async () => {
    const addr: IAddress = {} as any;

    const stub = createStub("sendAddress", addr);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'hashId'","should have required property 'line1'","should have required property 'line2'","should have required property 'recipient'","should have required property 'publicKey'"]`
    );
  });

  //

  it("invoke transaction with correct Courier model should return correct result", async () => {
    const courier: ICourier = {
      hashId: "hashId",
      name: "name",
      company: "company",
      telephone: "telephone",
      publicKey: Buffer.from("publicKey").toString("hex")
    };
    const expected = SimpleJSONSerializer.serialize(courier);

    const stub = createStub("sendCourier", courier);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const courier2: ICourier = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendCourier", courier2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Courier model should return error", async () => {
    const courier: ICourier = {} as any;

    const stub = createStub("sendCourier", courier);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'hashId'","should have required property 'name'","should have required property 'company'","should have required property 'telephone'","should have required property 'publicKey'"]`
    );
  });

  it("invoke transaction with correct Good model should return correct result", async () => {
    const good: IGood = {
      uuid: "uuid",
      name: "name",
      barcode: "barcode"
    };
    const expected = SimpleJSONSerializer.serialize(good);

    const stub = createStub("sendGood", good);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const good2: IGood = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendGood", good2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Good model should return error", async () => {
    const good: IGood = {} as any;

    const stub = createStub("sendGood", good);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'uuid'","should have required property 'name'","should have required property 'barcode'"]`
    );
  });

  it("invoke transaction with correct Stop model should return correct result", async () => {
    const stop: IStop = {
      address: "address",
      expectedArrivalTimestamp: 123,
      input: { goodUuid: 123 },
      output: { goodUuid: 123 },
      next: undefined
    };
    const expected = SimpleJSONSerializer.serialize(stop);

    const stub = createStub("sendStop", stop);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const stop2: IStop = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendStop", stop2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Stop model should return error", async () => {
    const stop: IStop = {} as any;

    const stub = createStub("sendStop", stop);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'address'","should have required property 'expectedArrivalTimestamp'","should have required property 'input'","should have required property 'output'"]`
    );
  });

  it("invoke transaction with correct Transport model should return correct result", async () => {
    const transport: ITransport = {
      courier: "courier",
      info: "info",
      destination: {
        address: "address",
        expectedArrivalTimestamp: 123,
        input: { goodUuid: 123 },
        output: { goodUuid: 123 },
        next: undefined
      }
    };
    const expected = SimpleJSONSerializer.serialize(transport);

    const stub = createStub("sendTransport", transport);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const transport2: ITransport = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendTransport", transport2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Transport model should return error", async () => {
    const transport: ITransport = {} as any;

    const stub = createStub("sendTransport", transport);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'courier'","should have required property 'info'","should have required property 'destination'"]`
    );
  });

  it("invoke transaction with correct CommitDetail model should return correct result", async () => {
    const commitDetail: ICommitDetail = {
      delta: { goodUuid: 123 },
      info: "info",
      timestamp: 123
    };
    const expected = SimpleJSONSerializer.serialize(commitDetail);

    const stub = createStub("sendCommitDetail", commitDetail);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const commitDetail2: ICommitDetail = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendCommitDetail", commitDetail2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect CommitDetail model should return error", async () => {
    const commitDetail: ICommitDetail = {} as any;

    const stub = createStub("sendCommitDetail", commitDetail);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'delta'","should have required property 'info'","should have required property 'timestamp'"]`
    );
  });

  it("invoke transaction with correct Commit model should return correct result", async () => {
    const commit: ICommit = {
      detail: {
        delta: { goodUuid: 123 },
        info: "info",
        timestamp: 123
      },
      signature: "signature"
    };
    const expected = SimpleJSONSerializer.serialize(commit);

    const stub = createStub("sendCommit", commit);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const commit2: ICommit = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendCommit", commit2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Commit model should return error", async () => {
    const commit: ICommit = {} as any;

    const stub = createStub("sendCommit", commit);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'detail'","should have required property 'signature'"]`
    );
  });

  it("invoke transaction with correct Segment model should return correct result", async () => {
    const segment: ISegment = {
      srcOutgoing: {
        detail: {
          delta: { goodUuid: 123 },
          info: "info",
          timestamp: 123
        },
        signature: "signature"
      },
      courierReceiving: {
        detail: {
          delta: { goodUuid: 456 },
          info: "info",
          timestamp: 456
        },
        signature: "signature"
      },
      courierDelivering: {
        detail: {
          delta: { goodUuid: 789 },
          info: "info",
          timestamp: 789
        },
        signature: "signature"
      },
      dstIncoming: {
        detail: {
          delta: { goodUuid: 123 },
          info: "info",
          timestamp: 123
        },
        signature: "signature"
      }
    };
    const expected = SimpleJSONSerializer.serialize(segment);

    const stub = createStub("sendSegment", segment);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const segment2: ISegment = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendSegment", segment2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Segment model should be fine", async () => {
    const segment: ISegment = {} as any;

    const expected = SimpleJSONSerializer.serialize(segment);
    const stub = createStub("sendSegment", segment);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);
  });

  it("invoke transaction with correct Route model should return correct result", async () => {
    const route: IRoute = {
      uuid: "uuid",
      goods: {
        goodUuid: {
          uuid: "uuid",
          name: "name",
          barcode: "barcode"
        }
      },
      addresses: {
        addressHashId: {
          hashId: "hashId",
          line1: "line1",
          line2: "line2",
          recipient: "recipient",
          publicKey: "publicKey"
        }
      },
      couriers: {
        courierHashId: {
          hashId: "hashId",
          name: "name",
          company: "company",
          telephone: "telephone",
          publicKey: "publicKey"
        }
      },
      source: {
        address: "address",
        expectedArrivalTimestamp: 123,
        input: { goodUuid: 123 },
        output: { goodUuid: 123 },
        next: undefined
      },
      commits: [
        {
          srcOutgoing: {
            detail: {
              delta: { goodUuid: 123 },
              info: "info",
              timestamp: 123
            },
            signature: "signature"
          },
          courierReceiving: {
            detail: {
              delta: { goodUuid: 123 },
              info: "info",
              timestamp: 123
            },
            signature: "signature"
          },
          courierDelivering: {
            detail: {
              delta: { goodUuid: 123 },
              info: "info",
              timestamp: 123
            },
            signature: "signature"
          },
          dstIncoming: {
            detail: {
              delta: { goodUuid: 123 },
              info: "info",
              timestamp: 123
            },
            signature: "signature"
          }
        }
      ]
    };
    const expected = SimpleJSONSerializer.serialize(route);

    const stub = createStub("sendRoute", route);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const route2: IRoute = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendRoute", route2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect Route model should return error", async () => {
    const route: IRoute = {} as any;

    const stub = createStub("sendRoute", route);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'uuid'","should have required property 'goods'","should have required property 'addresses'","should have required property 'couriers'","should have required property 'source'","should have required property 'commits'"]`
    );
  });

  it("invoke transaction with correct RouteProposal model should return correct result", async () => {
    const routeProposal: IRouteProposal = {
      route: {
        uuid: "uuid",
        goods: {
          goodUuid: {
            uuid: "uuid",
            name: "name",
            barcode: "barcode"
          }
        },
        addresses: {
          addressHashId: {
            hashId: "hashId",
            line1: "line1",
            line2: "line2",
            recipient: "recipient",
            publicKey: "publicKey"
          }
        },
        couriers: {
          courierHashId: {
            hashId: "hashId",
            name: "name",
            company: "company",
            telephone: "telephone",
            publicKey: "publicKey"
          }
        },
        source: {
          address: "address",
          expectedArrivalTimestamp: 123,
          input: { goodUuid: 123 },
          output: { goodUuid: 123 },
          next: undefined
        },
        commits: [
          {
            srcOutgoing: {
              detail: {
                delta: { goodUuid: 123 },
                info: "info",
                timestamp: 123
              },
              signature: "signature"
            },
            courierReceiving: {
              detail: {
                delta: { goodUuid: 123 },
                info: "info",
                timestamp: 123
              },
              signature: "signature"
            },
            courierDelivering: {
              detail: {
                delta: { goodUuid: 123 },
                info: "info",
                timestamp: 123
              },
              signature: "signature"
            },
            dstIncoming: {
              detail: {
                delta: { goodUuid: 123 },
                info: "info",
                timestamp: 123
              },
              signature: "signature"
            }
          }
        ]
      },
      signatures: { partyHashId: "KeyHexString" }
    };
    const expected = SimpleJSONSerializer.serialize(routeProposal);

    const stub = createStub("sendRouteProposal", routeProposal);
    const actual = await c.Invoke(stub);
    expect(actual.payload).to.deep.equal(expected);

    const routeProposal2: IRouteProposal = SimpleJSONSerializer.deserialize(actual.payload);

    const stub2 = createStub("sendRouteProposal", routeProposal2);
    const actual2 = await c.Invoke(stub2);
    expect(actual2.payload).to.deep.equal(expected);
  });

  it("invoke transaction with incorrect correct RouteProposal model should return error", async () => {
    const routeProposal: IRouteProposal = {} as any;

    const stub = createStub("sendRouteProposal", routeProposal);
    const actual = await c.Invoke(stub);

    expect(actual.payload).to.be.undefined;
    expect(actual.message).to.equal(
      `Unable to validate parameter due to ["should have required property 'route'","should have required property 'signatures'"]`
    );
  });
});
