import { KeyObject } from "node:crypto";
import { Address, Courier, Good, Route } from "./Models";
import {
  createHashIdObject,
  exportPublicKey,
  generateKeyPair,
  objectToSha256Hash,
  omitProperty,
  validateRoute
} from "./Utils";
import { expect } from "chai";
import { FirstStopView, LastStopView, MiddleStopView, RouteView } from "./RouteView";

function randomStringGenerator(): string {
  let rtn = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 16; i++) {
    rtn += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return rtn;
}

function generateAddress(): { obj: Address; pk: KeyObject } {
  const keyPair = generateKeyPair();
  return {
    obj: createHashIdObject({
      line1: randomStringGenerator(),
      line2: randomStringGenerator(),
      recipient: randomStringGenerator(),
      publicKey: exportPublicKey(keyPair.publicKey)
    }),
    pk: keyPair.privateKey
  };
}

function generateCourier(): { obj: Courier; pk: KeyObject } {
  const keyPair = generateKeyPair();
  return {
    obj: createHashIdObject({
      name: randomStringGenerator(),
      company: randomStringGenerator(),
      telephone: randomStringGenerator(),
      publicKey: exportPublicKey(keyPair.publicKey)
    }),
    pk: keyPair.privateKey
  };
}

function generateGood(): Good {
  return {
    uuid: randomStringGenerator(),
    name: randomStringGenerator(),
    barcode: randomStringGenerator()
  };
}

describe("RouteView", () => {
  const addrA = generateAddress();
  const addrB = generateAddress();
  const addrC = generateAddress();
  const courierA = generateCourier();
  const courierB = generateCourier();
  const goodA = generateGood();
  const goodB = generateGood();
  const goodC = generateGood();

  const route = {
    uuid: randomStringGenerator(),
    goods: {
      [goodA.uuid]: goodA,
      [goodB.uuid]: goodB,
      [goodC.uuid]: goodC
    },
    addresses: {
      [addrA.obj.hashId]: addrA.obj,
      [addrB.obj.hashId]: addrB.obj,
      [addrC.obj.hashId]: addrC.obj
    },
    couriers: {
      [courierA.obj.hashId]: courierA.obj,
      [courierB.obj.hashId]: courierB.obj
    },
    source: {
      address: addrA.obj.hashId,
      expectedArrivalTimestamp: 0,
      input: {},
      output: {
        [goodA.uuid]: 100,
        [goodB.uuid]: 30
      },
      next: {
        courier: courierA.obj.hashId,
        info: randomStringGenerator(),
        destination: {
          address: addrB.obj.hashId,
          expectedArrivalTimestamp: 1,
          input: {
            [goodA.uuid]: 50
          },
          output: {
            [goodB.uuid]: 50,
            [goodC.uuid]: 200
          },
          next: {
            courier: courierB.obj.hashId,
            info: randomStringGenerator(),
            destination: {
              address: addrC.obj.hashId,
              expectedArrivalTimestamp: 2,
              input: {
                [goodA.uuid]: 50,
                [goodB.uuid]: 80,
                [goodC.uuid]: 200
              },
              output: {},
              next: undefined
            }
          }
        }
      }
    },
    commits: [{}, {}]
  } as Route;

  it("should validate a route", () => {
    expect(validateRoute(route)).to.be.true;
  });

  it("", () => {
    const routeView = new RouteView(route);
  
    expect(routeView.stops.length).to.equal(3);

    expect(routeView.stops[0] instanceof FirstStopView).to.be.true;
    expect(routeView.stops[0].address).to.deep.equal(addrA.obj);
    expect(routeView.stops[0].expectedArrivalTimestamp).to.equal(0);
    expect(routeView.stops[0].previousStop).to.be.null;
    expect(routeView.stops[0].previousTransport).to.be.null;
    expect(routeView.stops[0].nextStop).to.equal(routeView.stops[1]);
    expect(routeView.stops[0].nextTransport).to.equal(routeView.transports[0]);

    expect(routeView.stops[1] instanceof MiddleStopView).to.be.true;
    expect(routeView.stops[1].address).to.deep.equal(addrB.obj);
    expect(routeView.stops[1].expectedArrivalTimestamp).to.equal(1);
    expect(routeView.stops[1].previousStop).to.equal(routeView.stops[0]);
    expect(routeView.stops[1].previousTransport).to.equal(routeView.transports[0]);
    expect(routeView.stops[1].nextStop).to.equal(routeView.stops[2]);
    expect(routeView.stops[1].nextTransport).to.equal(routeView.transports[1]);

    expect(routeView.stops[2] instanceof LastStopView).to.be.true;
    expect(routeView.stops[2].address).to.deep.equal(addrC.obj);
    expect(routeView.stops[2].expectedArrivalTimestamp).to.equal(2);
    expect(routeView.stops[2].previousStop).to.equal(routeView.stops[1]);
    expect(routeView.stops[2].previousTransport).to.equal(routeView.transports[1]);
    expect(routeView.stops[2].nextStop).to.be.null;
    expect(routeView.stops[2].nextTransport).to.be.null;

    expect(routeView.transports.length).to.equal(2);
    expect(routeView.transports[0].courier).to.equal(courierA.obj);
    expect(routeView.transports[1].courier).to.equal(courierB.obj);
    expect(routeView.uuid).to.equal(route.uuid);
    expect(routeView.moments.length).to.equal(8);
  });
});
