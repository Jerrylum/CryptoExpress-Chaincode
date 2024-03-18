import { contracts, serializers } from "../index";
import { ChaincodeFromContract } from "../lib/fabric-shim-internal";
import * as fs from "fs";
import "reflect-metadata";

const rootPath = process.cwd();
const metadata = JSON.parse(fs.readFileSync(`${rootPath}/contract-metadata/template.json`, "utf8"));
const c = new ChaincodeFromContract(contracts, serializers, metadata, "CryptoExpress Chaincode", "0.0.1");
const output = JSON.stringify(c.metadata, null, 2);

fs.writeFileSync("contract-metadata/metadata.json", output);
