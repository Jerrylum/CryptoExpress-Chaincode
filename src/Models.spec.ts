import { Context, Contract, JSONSerializer, Transaction } from "fabric-contract-api";

import { ChaincodeFromContract } from "./types/fabric-shim-internal";
import { ChaincodeStub } from "fabric-shim";
import sinon = require("sinon");
import winston = require("winston");
import { expect } from "chai";

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

const serializers = {
  transaction: "jsonSerializer",
  serializers: {
    jsonSerializer: JSONSerializer
  }
};

describe("Test Models Serialization", async () => {
  // get package.json root path
  const rootPath = process.cwd();
  // read text from META-INF/metadata.json
  const metadata = require(`${rootPath}/META-INF/metadata.json`);

  class TextContract extends Contract {
    @Transaction()
    public async textTransaction(ctx: Context, name: string) {
      return "hello " + name;
    }
  }

  const stub = sinon.createStubInstance(ExtendedChaincodeStub);

  stub.getBufferArgs.returns([Buffer.from("textTransaction"), Buffer.from("world")]);
  stub.getTxID.returns("txId");
  stub.getChannelID.returns("channelId");
  stub.getCreator.returns({ mspid: "mspId", idBytes: Buffer.from(certWithAttrs) });

  const c = new ChaincodeFromContract([TextContract], serializers, metadata, "title", "version");

  const rtn = await c.Invoke(stub);

  const expected = Buffer.from("hello world");

  it("should return expected value", () => {
    expect(rtn.payload).to.deep.equal(expected);
  });
});
