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
  isValidUuidObjectCollection
} from "./Utils";
import { HashIdObject, PublicKeyObject, UuidObject } from "./Models";

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
});
