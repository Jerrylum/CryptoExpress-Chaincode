import { expect } from "chai";
import {
  omitProperty,
  isValidHashIdObject,
  objectToSha256Hash,
  isValidHashIdObjectCollection,
  generateKeyPair,
  signObject,
  verifyObject,
  exportPrivateKey,
  exportPublicKey,
  isValidPublicKey,
  isValidPublicKeyObjectCollection,
  isValidUuid,
  isValidUuidObjectCollection,
  isValidRouteDetail,
  isEmptySegment,
  isEmptySegmentList,
  validateRoute,
  getCommitTimeline
} from "./Utils";
import { Address, Courier, HashIdObject, PublicKeyObject, Segment, Stop, UuidObject } from "./Models";

describe("Test Utils", async () => {
  class TestClass implements HashIdObject {
    hashId!: string;
    a!: string;
    b!: string;
    c!: string;
  }

  it("omitProperty should remove specific property", async () => {
    const testObject = new TestClass();
    testObject.hashId = "hashId";
    testObject.a = "a";
    testObject.b = "b";
    testObject.c = "c";
    const result = omitProperty(testObject, "b");

    expect(result).to.not.have.property("b");
  });

  it("isValidHashIdObject should validate the hash", async () => {
    const testObject = new TestClass();
    testObject.a = "a";
    testObject.b = "b";
    testObject.c = "c";
    testObject.hashId = objectToSha256Hash(omitProperty(testObject, "hashId"));
    expect(isValidHashIdObject(testObject)).to.be.true;
  });

  it("isValidHashIdObject should validate the hash(2)", async () => {
    const testObject = new TestClass();
    testObject.a = "a";
    testObject.b = "b";
    testObject.c = "c";
    testObject.hashId = "invalid hash";
    expect(isValidHashIdObject(testObject)).to.be.false;
  });

  it("isValidHashIdObjectCollection should validate the hash collection", async () => {
    var testObject = new TestClass();
    testObject.a = "a";
    testObject.b = "b";
    testObject.c = "c";
    testObject.hashId = objectToSha256Hash(omitProperty(testObject, "hashId"));

    var testObject2 = new TestClass();
    testObject2.a = "d";
    testObject2.b = "e";
    testObject2.c = "f";
    testObject2.hashId = objectToSha256Hash(omitProperty(testObject2, "hashId"));

    // create object like {testObject.hashId: testObject}
    var objCollection: { [hashId: string]: HashIdObject };
    objCollection = {};
    objCollection[testObject.hashId] = testObject;
    objCollection[testObject2.hashId] = testObject2;

    expect(isValidHashIdObjectCollection(objCollection)).to.be.true;
  });

  it("isValidHashIdObjectCollection should validate the hash collection(2)", async () => {
    var testObject = new TestClass();
    testObject.a = "a";
    testObject.b = "b";
    testObject.c = "c";
    testObject.hashId = objectToSha256Hash(omitProperty(testObject, "hashId"));

    var testObject2 = new TestClass();
    testObject2.a = "d";
    testObject2.b = "e";
    testObject2.c = "f";
    testObject2.hashId = objectToSha256Hash(omitProperty(testObject2, "hashId"));

    // create object like {testObject.hashId: testObject}
    var objCollection: { [hashId: string]: HashIdObject };
    objCollection = {};
    objCollection[testObject.hashId] = testObject;
    objCollection[testObject2.hashId] = testObject2;

    // modify hashId
    testObject2.hashId = "invalid hash";
    objCollection[testObject2.hashId] = testObject2;

    expect(isValidHashIdObjectCollection(objCollection)).to.be.false;
  });

  it("isValidPublicKey should validate the public key", async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const pk = exportPublicKey(publicKey);
    expect(isValidPublicKey(pk)).to.be.true;
  });

  it("isValidPublicKey should validate the public key(2)", async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const pk = exportPrivateKey(privateKey);
    expect(isValidPublicKey(pk)).to.be.false;
  });

  it("isValidPublicKeyObjectCollection should validate the public key collection", async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const pk = exportPublicKey(publicKey);
    const pk2 = exportPublicKey(generateKeyPair().publicKey);

    // create object like {pk: publicKey}
    var objCollection: { [pk: string]: PublicKeyObject };
    objCollection = {};
    objCollection[pk] = { publicKey: pk };
    objCollection[pk2] = { publicKey: pk2 };

    expect(isValidPublicKeyObjectCollection(objCollection)).to.be.true;
  });

  it("isValidPublicKeyObjectCollection should validate the public key collection(2)", async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const pk = exportPublicKey(publicKey);
    const pk2 = exportPublicKey(generateKeyPair().publicKey);

    // create object like {pk: publicKey}
    var objCollection: { [pk: string]: PublicKeyObject };
    objCollection = {};
    objCollection[pk] = { publicKey: pk };
    objCollection[pk2] = { publicKey: pk2 };

    // modify pk2
    objCollection[pk2].publicKey = "invalid public key";

    expect(isValidPublicKeyObjectCollection(objCollection)).to.be.false;
  });

  it("generateKeyPair, signObject, verifyObject should work", async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const testObject = new TestClass();
    testObject.a = "a";
    testObject.b = "b";
    testObject.c = "c";
    testObject.hashId = objectToSha256Hash(omitProperty(testObject, "hashId"));

    const sk = exportPrivateKey(privateKey);
    const pk = exportPublicKey(publicKey);
    const signature = signObject(testObject, sk);
    expect(verifyObject(testObject, signature, pk)).to.be.true;
  });

  it("isValidUuid should validate the uuid", async () => {
    const uuid = "550e8400e29b41d4a716446655440000";
    expect(isValidUuid(uuid)).to.be.true;
  });

  it("isValidUuid should validate the uuid(2)", async () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(isValidUuid(uuid + "invalid")).to.be.false;
  });

  it("isValidUuidObjectCollection should validate the uuid collection", async () => {
    const uuid = "550e8400e29b41d4a716446655440000";
    const uuid2 = "550e8400e29b41d4a716446655440001";

    // create object like {uuid: uuid}
    var objCollection: { [uuid: string]: UuidObject};
    objCollection = {};
    objCollection[uuid] = {"uuid": uuid};
    objCollection[uuid2] = {"uuid": uuid2};

    expect(isValidUuidObjectCollection(objCollection)).to.be.true;
  });

  it("isValidUuidObjectCollection should validate the uuid collection(2)", async () => {
    const uuid = "550e8400e29b41d4a716446655440000";
    // invalid uuid
    const uuid2 = "550e8400-e29b-41d4-a716-446655440000";

    // create object like {uuid: uuid}
    var objCollection: { [uuid: string]: UuidObject};
    objCollection = {};
    objCollection[uuid] = {"uuid": uuid};
    objCollection[uuid2] = {"uuid": uuid2};

    expect(isValidUuidObjectCollection(objCollection)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail", async () => {
    // invalid, only 1 stop
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: 0,
      input: {},
      output: {},
      next: undefined
    };

    expect(isValidRouteDetail([], [], [], routeDetail)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail(2)", async () => {
    // invalid address hashId of stop
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: -10,
      input: {},
      output: {},
      next: {
        courier: "hashId2",
        info: "info",
        destination: {
          address: "hashId3",
          expectedArrivalTimestamp: 0,
          input: {},
          output: {},
          next: undefined
        }
      }
    };

    expect(isValidRouteDetail([], [], [], routeDetail)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail(3)", async () => {
    // invalid expectedArrivalTimestamp of stop
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: -10,
      input: {},
      output: {},
      next: {
        courier: "hashId2",
        info: "info",
        destination: {
          address: "hashId3",
          expectedArrivalTimestamp: 0,
          input: {},
          output: {},
          next: undefined
        }
      }
    };

    expect(isValidRouteDetail(["hashId"], [], [], routeDetail)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail(4)", async () => {
    // invalid match in input
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: 0,
      input: {"uuid1": 1},
      output: {},
      next: {
        courier: "hashId2",
        info: "info",
        destination: {
          address: "hashId3",
          expectedArrivalTimestamp: 0,
          input: {},
          output: {},
          next: undefined
        }
      }
    };

    expect(isValidRouteDetail(["hashId"], [], [], routeDetail)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail(5)", async () => {
    // invalid match in output
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: 0,
      input: {},
      output: {"uuid1": 1},
      next: {
        courier: "hashId2",
        info: "info",
        destination: {
          address: "hashId3",
          expectedArrivalTimestamp: 0,
          input: {},
          output: {},
          next: undefined
        }
      }
    };

    expect(isValidRouteDetail(["hashId"], [], [], routeDetail)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail(6)", async () => {
    // invalid courier hashId of transport
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: 0,
      input: {"uuid1": 1},
      output: {"uuid1": 1},
      next: {
        courier: "hashId",
        info: "info",
        destination: {
          address: "hashId3",
          expectedArrivalTimestamp: 0,
          input: {},
          output: {},
          next: undefined
        }
      }
    };

    expect(isValidRouteDetail(["hashId"], [], ["uuid1"], routeDetail)).to.be.false;
  });

  it("isValidRouteDetail should validate the route detail(7)", async () => {
    // valid route detail
    var routeDetail: Stop = {
      address: "hashId",
      expectedArrivalTimestamp: 0,
      input: {"uuid1": 1},
      output: {"uuid1": 1},
      next: {
        courier: "hashId2",
        info: "info",
        destination: {
          address: "hashId3",
          expectedArrivalTimestamp: 10,
          input: {"uuid1": 1},
          output: {"uuid1": 1},
          next: undefined
        }
      }
    };

    expect(isValidRouteDetail(["hashId", "hashId3"], ["hashId2"], ["uuid1"], routeDetail)).to.be.true;
  });

  it("isEmptySegment should validate the segment", async () => {
    var s: Segment = { 
      srcOutgoing: undefined,
      courierReceiving: undefined,
      courierDelivering: undefined,
      dstIncoming: undefined
    };
    expect(isEmptySegment(s)).to.be.true;
  });

  it("isEmptySegment should validate the segment(2)", async () => {
    var s: Segment = { 
      srcOutgoing: {
        detail: {
          delta: {},
          info: "info",
          timestamp: 0
        },
        signature: "signature"
      },
      courierReceiving: undefined,
      courierDelivering: undefined,
      dstIncoming: undefined
    };
    expect(isEmptySegment(s)).to.be.false;
  });

  it("isEmptySegmentList should validate the segment list", async () => {
    var s: Segment = { 
      srcOutgoing: undefined,
      courierReceiving: undefined,
      courierDelivering: undefined,
      dstIncoming: undefined
    };
    expect(isEmptySegmentList([s])).to.be.true;
  });

  it("isEmptySegmentList should validate the segment list(2)", async () => {
    var s: Segment = { 
      srcOutgoing: {
        detail: {
          delta: {},
          info: "info",
          timestamp: 0
        },
        signature: "signature"
      },
      courierReceiving: undefined,
      courierDelivering: undefined,
      dstIncoming: undefined
    };
    expect(isEmptySegmentList([s])).to.be.false;
  });

  // export class Route implements UuidObject {
  //   uuid!: string;
  //   goods!: { [goodUuid: string]: Good };
  //   addresses!: { [addressHashId: string]: Address };
  //   couriers!: { [courierHashId: string]: Courier };
  //   source!: Stop;
  //   commits!: Segment[];
  // }
  it("validateRoute should validate the route", async () => {
    // invalid route detail
    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {},
      addresses: {},
      couriers: {},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };
    expect(() => validateRoute(route)).to.throw("The route detail is not valid.");
  });

  it("validateRoute should validate the route(2)", async () => {
    // invalid uuid
    var route = {
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      goods: {},
      addresses: {},
      couriers: {},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };
    expect(() => validateRoute(route)).to.throw("The route proposal uuid is not valid.");
  });

  // export class Route implements UuidObject {
  //   uuid!: string;
  //   goods!: { [goodUuid: string]: Good };
  //   addresses!: { [addressHashId: string]: Address };
  //   couriers!: { [courierHashId: string]: Courier };
  //   source!: Stop;
  //   commits!: Segment[];
  // }

  // export class Good implements UuidObject {
  //   uuid!: string;
  //   name!: string;
  //   barcode!: string;
  // }

  it("validateRoute should validate the route(3)", async () => {
    // invalid good uuid
    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {"uuid": {uuid: "invalid uuid", name: "name", barcode: "barcode"}},
      addresses: {},
      couriers: {},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };

    expect(() => validateRoute(route)).to.throw("One of the goods uuid is not valid.");
  });

  // export class Address implements HashIdObject, PublicKeyObject {
  //   hashId!: string; // hash of the remaining fields
  //   line1!: string;
  //   line2!: string;
  //   recipient!: string;
  //   publicKey!: KeyHexString;
  // }
  it("validateRoute should validate the route(4)", async () => {
    // invalid address hashId
    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {},
      addresses: {"hashId": {hashId: "invalid hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: "publicKey"}},
      couriers: {},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };

    expect(() => validateRoute(route)).to.throw("One of the address hash is not valid.");
  });

  it("validateRoute should validate the route(5)", async () => {
    // invalid address publicKey
    var address: Address = {hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: "invalid publicKey"};
    address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {},
      addresses: {[address.hashId]: address},
      couriers: {},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };

    expect(() => validateRoute(route)).to.throw("One of the address public key is not valid.");
  });


  // export class Courier implements HashIdObject, PublicKeyObject {
  //   hashId!: string; // hash of the remaining fields
  //   name!: string;
  //   company!: string;
  //   telephone!: string;
  //   publicKey!: KeyHexString;
  // }
  it("validateRoute should validate the route(6)", async () => {
    // invalid courier hashId
    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {},
      addresses: {},
      couriers: {"hashId": {hashId: "invalid hashId", name: "name", company: "company", telephone: "telephone", publicKey: "publicKey"}},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };

    expect(() => validateRoute(route)).to.throw("One of the courier hash is not valid.");
  });

  it("validateRoute should validate the route(7)", async () => {
    // invalid courier publicKey
    var courier: Courier = {hashId: "hashId", name: "name", company: "company", telephone: "telephone", publicKey: "invalid publicKey"};
    courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));
    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {},
      addresses: {},
      couriers: {[courier.hashId]: courier},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {},
        output: {},
        next: undefined
      },
      commits: []
    };

    expect(() => validateRoute(route)).to.throw("One of the courier public key is not valid.");
  });

  it ("validateRoute should validate the route(8)", async () => {
    // invalid number of segment
    var pk = exportPublicKey(generateKeyPair().publicKey);
    var address: Address = {hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: pk};
    address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
    var courier: Courier = {hashId: "hashId2", name: "name", company: "company", telephone: "telephone", publicKey: pk};
    courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));

    // uuid need to satisfy target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
    var testUuid = "550e8400e29b41d4a716446655440000";
    var routeDetail: Stop = {
      address: address.hashId,
      expectedArrivalTimestamp: 0,
      input: {[testUuid]: 1},
      output: {[testUuid]: 1},
      next: {
        courier: courier.hashId,
        info: "info",
        destination: {
          address: address.hashId,
          expectedArrivalTimestamp: 10,
          input: {[testUuid]: 1},
          output: {[testUuid]: 1},
          next: undefined
        }
      }
    };

    //route should fulfill "number of transport = number of segment object", 2add+1~2courier -> each of them 4 commit -> 1 segment

    // export class CommitDetail {
    //   delta!: { [goodUuid: string]: number };
    //   info!: string;
    //   timestamp!: number;
    // }
    
    // export class Commit {
    //   detail!: CommitDetail;
    //   signature!: SignatureHexString;
    // }

    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {[testUuid]: {uuid: testUuid, name: "name", barcode: "barcode"}},
      addresses: {[address.hashId]: address},
      couriers: {[courier.hashId]: courier},
      source: routeDetail,
      commits: [] // 4 commit for 1 segment, 2 address + 1~2 courier
    };

    expect(() => validateRoute(route)).to.be.throw("The number of segments does not match the number of transport.");
  });

  it ("validateRoute should validate the route(9)", async () => {
    // valid route
    var pk = exportPublicKey(generateKeyPair().publicKey);
    var address: Address = {hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: pk};
    address.hashId = objectToSha256Hash(omitProperty(address, "hashId"));
    var courier: Courier = {hashId: "hashId2", name: "name", company: "company", telephone: "telephone", publicKey: pk};
    courier.hashId = objectToSha256Hash(omitProperty(courier, "hashId"));

    // uuid need to satisfy target.length >= 16 && target.length <= 64 && /^[a-zA-Z0-9]+$/.test(target);
    var testUuid = "550e8400e29b41d4a716446655440000";
    var routeDetail: Stop = {
      address: address.hashId,
      expectedArrivalTimestamp: 0,
      input: {[testUuid]: 1},
      output: {[testUuid]: 1},
      next: {
        courier: courier.hashId,
        info: "info",
        destination: {
          address: address.hashId,
          expectedArrivalTimestamp: 10,
          input: {[testUuid]: 1},
          output: {[testUuid]: 1},
          next: undefined
        }
      }
    };

    //route should fulfill "number of transport = number of segment object", 2add+1~2courier -> each of them 4 commit -> 1 segment
    var commit = {
      detail: {
        delta: {[testUuid]: 1},
        info: "info",
        timestamp: 0
      },
      signature: "signature"
    };

    var segment = {
      srcOutgoing: commit,
      courierReceiving: commit,
      courierDelivering: commit,
      dstIncoming: commit
    };

    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {[testUuid]: {uuid: testUuid, name: "name", barcode: "barcode"}},
      addresses: {[address.hashId]: address},
      couriers: {[courier.hashId]: courier},
      source: routeDetail,
      commits: [segment]
    };

    expect(validateRoute(route)).to.be.true;
  });

  it ("getCommitTimeline should get the commit timeline", async () => {
    var commit = {
      detail: {
        delta: {"uuid": 1},
        info: "info",
        timestamp: 0
      },
      signature: "signature"
    };

    var segment = {
      srcOutgoing: commit,
      courierReceiving: commit,
      courierDelivering: commit,
      dstIncoming: commit
    };

    var route = {
      uuid: "550e8400e29b41d4a716446655440000",
      goods: {"uuid": {uuid: "uuid", name: "name", barcode: "barcode"}},
      addresses: {"hashId": {hashId: "hashId", line1: "line1", line2: "line2", recipient: "recipient", publicKey: "publicKey"}},
      couriers: {"hashId": {hashId: "hashId", name: "name", company: "company", telephone: "telephone", publicKey: "publicKey"}},
      source: {
        address: "hashId",
        expectedArrivalTimestamp: 0,
        input: {"uuid": 1},
        output: {"uuid": 1},
        next: {
          courier: "hashId",
          info: "info",
          destination: {
            address: "hashId",
            expectedArrivalTimestamp: 10,
            input: {"uuid": 1},
            output: {"uuid": 1},
            next: undefined
          }
        }
      },
      commits: [segment]
    };

    expect(getCommitTimeline(route).length).to.be.equal(4);
  });

});
