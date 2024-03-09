import { Contract } from "fabric-contract-api";
import { logger as Logger } from "../lib/fabric-shim-internal";
import { annotationsUtils } from "../lib/fabric-contract-api-internal";
import "reflect-metadata";

const logger = Logger.getLogger("./annotations/transaction.js");

// Adopted from https://www.npmjs.com/package/get-params? under MIT License
function getParams(func: Function) {
  if (typeof func !== "function") {
    return [];
  }

  const patternComments = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
  const patternArguments = /([^\s,]+)/g;

  const funcString = func.toString().replace(patternComments, "");

  const result = funcString.slice(funcString.indexOf("(") + 1, funcString.indexOf(")")).match(patternArguments);

  if (result === null) {
    return [];
  }

  return [...result];
}

interface Parameter {
  name: string;
  description: string;
  schema: any;
}

interface Transaction {
  name: string;
  tag: string[];
  parameters: Parameter[];
}

// Adopted from https://github.com/hyperledger/fabric-chaincode-node under Apache-2.0
export function BetterTransaction(commit = true) {
  return (target: Contract, propertyKey: string) => {
    logger.info(
      "@Transaction args:",
      `Property Key -> ${propertyKey}, Commit -> ${commit},`,
      "Target ->",
      target.constructor.name
    );

    const transactions: Transaction[] = Reflect.getMetadata("fabric:transactions", target) || [];

    logger.debug("Existing fabric:transactions", transactions);

    const transaction = annotationsUtils.findByValue(transactions, "name", propertyKey);
    const paramNames = getParams((target as any)[propertyKey]);

    logger.debug(
      "@Transaction params:",
      `Property Key -> ${propertyKey}, Param Names ->  ${JSON.stringify(paramNames)},`,
      "Target ->",
      target.constructor.name
    );

    const description = "";
    const contextType = target.createContext().constructor;

    logger.debug(`Transaction ${target} -> ${propertyKey} params`, paramNames);

    const paramTypes: any[] = Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];

    let numRemoved = 0;
    const parameters = paramTypes
      .filter((paramType: any, paramIdx: number) => {
        const filter = paramType === contextType;

        if (filter) {
          logger.debug(
            "@Transaction ignoring param as matched context type",
            `Property Key -> ${propertyKey}, Param Name ->, ${paramNames[paramIdx]},`,
            "Target ->",
            target.constructor.name
          );
          paramNames.splice(paramIdx - numRemoved++, 1);
        }

        return !filter;
      })
      .map((paramType: any, paramIdx: number) => {
        const paramName = paramNames[paramIdx];
        const obj: Parameter = {
          name: paramName,
          description,
          schema: {}
        };

        const type = typeof paramType === "function" ? paramType.name : paramType.toString();
        // Jerry: This is different from the original code, we don't require the type to be a class
        // if (type === "Object") {
        //   throw new Error(`Type not properly specified for parameter ${paramName}, can not process pure Object types`);
        // }
        obj.schema = annotationsUtils.generateSchema(type);

        return obj;
      });

    if (transaction && transaction.parameters) {
      transaction.parameters.forEach(tParam => {
        for (let i = 0; i < parameters.length; i++) {
          if (parameters[i].name === tParam.name) {
            parameters[i] = tParam;
          }
        }
      });
    }

    const tag = [];
    if (commit) {
      tag.push("SUBMIT");
      tag.push("submitTx");
    } else {
      tag.push("EVALUATE");
    }

    annotationsUtils.appendOrUpdate(transactions, "name", propertyKey, {
      tag: tag,
      parameters: parameters
    });

    Reflect.defineMetadata("fabric:transactions", transactions, target);
    logger.debug("Updated fabric:transactions", transactions);
  };
}
