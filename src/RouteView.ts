import { Address, Courier, Stop, Transport, Commit, Route, Segment, Good } from "./Models";

export class RouteSourceOutgoingMoment {
  get entity(): Readonly<Address> {
    return this.currentStop.address;
  }
  readonly event = "srcOutgoing";
  readonly currentStop: FirstStopView | MiddleStopView;
  get transport(): TransportView {
    return this.currentStop.nextTransport;
  }
  get nextStop(): MiddleStopView | LastStopView {
    return this.transport.destination;
  }
  get expectedDelta(): GoodMoment[] {
    return this.currentStop.expectedOutput;
  }
  get expectedTimestamp(): number {
    return this.currentStop.expectedArrivalTimestamp;
  }
  readonly actualDelta: ReadonlyArray<GoodMoment> | null;
  get actualTimestamp(): number | null {
    return this.commit ? this.commit.detail.timestamp : null;
  }
  readonly commit: Commit | null;

  constructor(currentStop: FirstStopView | MiddleStopView, forwardSegment: Readonly<Segment>) {
    this.currentStop = currentStop;
    this.commit = forwardSegment.srcOutgoing || null;
    if (this.commit) {
      this.actualDelta = Object.entries(this.commit.detail.delta).map(
        ([uuid, quantity]) => new GoodMoment(this.currentStop.route.model.goods[uuid], quantity)
      );
    } else {
      this.actualDelta = null;
    }
  }
}

export class RouteCourierReceivingMoment {
  get entity(): Readonly<Courier> {
    return this.transport.courier;
  }
  readonly event = "courierReceiving";
  readonly currentStop: FirstStopView | MiddleStopView;
  get transport(): TransportView {
    return this.currentStop.nextTransport;
  }
  get nextStop(): MiddleStopView | LastStopView {
    return this.transport.destination;
  }
  get expectedDelta(): GoodMoment[] {
    return this.currentStop.expectedOutput;
  }
  get expectedTimestamp(): number {
    return this.currentStop.expectedArrivalTimestamp;
  }
  readonly actualDelta: ReadonlyArray<GoodMoment> | null;
  get actualTimestamp(): number | null {
    return this.commit ? this.commit.detail.timestamp : null;
  }
  readonly commit: Commit | null;

  constructor(currentStop: FirstStopView | MiddleStopView, forwardSegment: Readonly<Segment>) {
    this.currentStop = currentStop;
    this.commit = forwardSegment.courierReceiving || null;
    if (this.commit) {
      this.actualDelta = Object.entries(this.commit.detail.delta).map(
        ([uuid, quantity]) => new GoodMoment(this.currentStop.route.model.goods[uuid], quantity)
      );
    } else {
      this.actualDelta = null;
    }
  }
}

export class RouteCourierDeliveringMoment {
  get entity(): Readonly<Courier> {
    return this.transport.courier;
  }
  readonly event = "courierDelivering";
  readonly currentStop: MiddleStopView | LastStopView;
  get previousStop(): FirstStopView | MiddleStopView {
    return this.transport.source;
  }
  get transport(): TransportView {
    return this.currentStop.previousTransport;
  }
  get expectedDelta(): GoodMoment[] {
    return this.currentStop.expectedInput;
  }
  get expectedTimestamp(): number {
    return this.currentStop.expectedArrivalTimestamp;
  }
  readonly actualDelta: ReadonlyArray<GoodMoment> | null;
  get actualTimestamp(): number | null {
    return this.commit ? this.commit.detail.timestamp : null;
  }
  readonly commit: Commit | null;

  constructor(currentStop: MiddleStopView | LastStopView, backwardSegment: Readonly<Segment>) {
    this.currentStop = currentStop;
    this.commit = backwardSegment.courierDelivering || null;
    if (this.commit) {
      this.actualDelta = Object.entries(this.commit.detail.delta).map(
        ([uuid, quantity]) => new GoodMoment(this.currentStop.route.model.goods[uuid], quantity)
      );
    } else {
      this.actualDelta = null;
    }
  }
}

export class RouteDestinationIncomingMoment {
  get entity(): Readonly<Address> {
    return this.currentStop.address;
  }
  readonly event = "dstIncoming";
  readonly currentStop: MiddleStopView | LastStopView;
  get previousStop(): FirstStopView | MiddleStopView {
    return this.transport.source;
  }
  get transport(): TransportView {
    return this.currentStop.previousTransport;
  }
  get expectedDelta(): GoodMoment[] {
    return this.currentStop.expectedInput;
  }
  get expectedTimestamp(): number {
    return this.currentStop.expectedArrivalTimestamp;
  }
  readonly actualDelta: ReadonlyArray<GoodMoment> | null;
  get actualTimestamp(): number | null {
    return this.commit ? this.commit.detail.timestamp : null;
  }
  readonly commit: Commit | null;

  constructor(currentStop: MiddleStopView | LastStopView, backwardSegment: Readonly<Segment>) {
    this.currentStop = currentStop;
    this.commit = backwardSegment.dstIncoming || null;
    if (this.commit) {
      this.actualDelta = Object.entries(this.commit.detail.delta).map(
        ([uuid, quantity]) => new GoodMoment(this.currentStop.route.model.goods[uuid], quantity)
      );
    } else {
      this.actualDelta = null;
    }
  }
}

export type RouteMoment =
  | RouteSourceOutgoingMoment
  | RouteCourierReceivingMoment
  | RouteCourierDeliveringMoment
  | RouteDestinationIncomingMoment;

export class GoodMoment {
  readonly uuid: string;
  readonly name: string;
  readonly barcode: string;
  readonly quantity: number;

  constructor(good: Good, quantity: number) {
    this.uuid = good.uuid;
    this.name = good.name;
    this.barcode = good.barcode;
    this.quantity = quantity;
  }
}

export class TransportView {
  readonly route: Route;
  readonly courier: Courier;
  readonly info: string;
  readonly source: FirstStopView | MiddleStopView;
  readonly destination: MiddleStopView | LastStopView;

  readonly srcOutgoing: RouteSourceOutgoingMoment;
  readonly courierReceiving: RouteCourierReceivingMoment;
  readonly courierDelivering: RouteCourierDeliveringMoment;
  readonly dstIncoming: RouteDestinationIncomingMoment;

  getAllMoments(): RouteMoment[] {
    // returns all moments in order
    return [this.srcOutgoing, this.courierReceiving, this.courierDelivering, this.dstIncoming];
  }

  get expectedInput(): GoodMoment[] {
    return this.srcOutgoing.expectedDelta;
  }
  get expectedOutput(): GoodMoment[] {
    return this.dstIncoming.expectedDelta;
  }

  get expectedDuration(): number {
    return this.dstIncoming.expectedTimestamp - this.srcOutgoing.expectedTimestamp;
  }

  get actualDuration(): number | null {
    if (this.dstIncoming.actualTimestamp === null) {
      return null;
    }

    if (this.srcOutgoing.actualTimestamp === null) {
      return null;
    }
    return this.dstIncoming.actualTimestamp - this.srcOutgoing.actualTimestamp;
  }

  constructor(
    route: RouteView,
    source: FirstStopView | MiddleStopView,
    transport: Transport,
    segmentIndex: number
  ) {
    this.route = route.model;
    this.courier = route.model.couriers[transport.courier];
    this.info = transport.info;
    this.source = source;
    if (transport.destination.next) {
      this.destination = new MiddleStopView(route, this, transport.destination, segmentIndex + 1);
    } else {
      this.destination = new LastStopView(route, this, transport.destination);
    }

    const currentSegment = route.model.commits[segmentIndex];
    this.srcOutgoing = new RouteSourceOutgoingMoment(source, currentSegment);
    this.courierReceiving = new RouteCourierReceivingMoment(source, currentSegment);
    this.courierDelivering = new RouteCourierDeliveringMoment(this.destination, currentSegment);
    this.dstIncoming = new RouteDestinationIncomingMoment(this.destination, currentSegment);
  }
}

export abstract class StopView {
  readonly route: RouteView;
  readonly address: Readonly<Address>;

  abstract courierDelivering: RouteCourierDeliveringMoment | null;
  abstract dstIncoming: RouteDestinationIncomingMoment | null;
  abstract srcOutgoing: RouteSourceOutgoingMoment | null;
  abstract courierReceiving: RouteCourierReceivingMoment | null;

  abstract expectedArrivalTimestamp: number; // Stop.expectedArrivalTimestamp
  readonly expectedInput: GoodMoment[];
  readonly expectedOutput: GoodMoment[];

  abstract previousStop: FirstStopView | MiddleStopView | null;
  abstract previousTransport: TransportView | null;
  abstract nextTransport: TransportView | null;
  abstract nextStop: MiddleStopView | LastStopView | null;

  constructor(route: RouteView, stop: Stop) {
    this.route = route;
    this.address = route.model.addresses[stop.address];
    this.expectedInput = Object.entries(stop.input).map(
      ([uuid, quantity]) => new GoodMoment(route.model.goods[uuid], quantity)
    );
    this.expectedOutput = Object.entries(stop.output).map(
      ([uuid, quantity]) => new GoodMoment(route.model.goods[uuid], quantity)
    );
  }
}

export class FirstStopView extends StopView {
  readonly expectedArrivalTimestamp: number;

  readonly previousStop = null;
  readonly previousTransport = null;
  readonly nextTransport: TransportView;
  readonly nextStop: MiddleStopView | LastStopView;

  readonly courierDelivering = null;
  readonly dstIncoming = null;
  readonly srcOutgoing: RouteSourceOutgoingMoment;
  readonly courierReceiving: RouteCourierReceivingMoment;

  constructor(route: RouteView, stop: Stop) {
    super(route, stop);

    if (!stop.next) throw new Error("First stop must have a next transport");

    const forwardSegment = route.model.commits[0];

    this.nextTransport = new TransportView(route, this, stop.next, 0);
    this.nextStop = this.nextTransport.destination;
    this.expectedArrivalTimestamp = stop.expectedArrivalTimestamp;

    this.srcOutgoing = new RouteSourceOutgoingMoment(this, forwardSegment);
    this.courierReceiving = new RouteCourierReceivingMoment(this, forwardSegment);
  }
}

export class MiddleStopView extends StopView {
  readonly expectedArrivalTimestamp: number;

  readonly previousStop: FirstStopView | MiddleStopView;
  readonly previousTransport: TransportView;
  readonly nextTransport: TransportView;
  readonly nextStop: MiddleStopView | LastStopView;

  readonly courierDelivering: RouteCourierDeliveringMoment;
  readonly dstIncoming: RouteDestinationIncomingMoment;
  readonly srcOutgoing: RouteSourceOutgoingMoment;
  readonly courierReceiving: RouteCourierReceivingMoment;

  constructor(route: RouteView, previousTransport: TransportView, stop: Stop, segmentIndex: number) {
    super(route, stop);

    if (!stop.next) throw new Error("Middle stop must have a next transport");

    const backwardSegment = route.model.commits[segmentIndex - 1];
    const forwardSegment = route.model.commits[segmentIndex];

    this.previousStop = previousTransport.source;
    this.previousTransport = previousTransport;
    this.nextTransport = new TransportView(route, this, stop.next, segmentIndex);
    this.nextStop = this.nextTransport.destination;
    this.expectedArrivalTimestamp = stop.expectedArrivalTimestamp;

    this.courierDelivering = new RouteCourierDeliveringMoment(this, backwardSegment);
    this.dstIncoming = new RouteDestinationIncomingMoment(this, backwardSegment);
    this.srcOutgoing = new RouteSourceOutgoingMoment(this, forwardSegment);
    this.courierReceiving = new RouteCourierReceivingMoment(this, forwardSegment);
  }
}

export class LastStopView extends StopView {
  readonly expectedArrivalTimestamp: number;

  readonly previousStop: FirstStopView | MiddleStopView;
  readonly previousTransport: TransportView;
  readonly nextTransport = null;
  readonly nextStop = null;

  readonly courierDelivering: RouteCourierDeliveringMoment;
  readonly dstIncoming: RouteDestinationIncomingMoment;
  readonly srcOutgoing = null;
  readonly courierReceiving = null;
  
  constructor(route: RouteView, previousTransport: TransportView, stop: Stop) {
    super(route, stop);

    const backwardSegment = route.model.commits[route.model.commits.length - 1];

    this.previousStop = previousTransport.source;
    this.previousTransport = previousTransport;
    this.expectedArrivalTimestamp = stop.expectedArrivalTimestamp;

    this.courierDelivering = new RouteCourierDeliveringMoment(this, backwardSegment);
    this.dstIncoming = new RouteDestinationIncomingMoment(this, backwardSegment);
  }
}

export class RouteView {
  readonly stops: ReadonlyArray<FirstStopView | MiddleStopView | LastStopView>;
  readonly transports: ReadonlyArray<TransportView>;

  constructor(readonly model: Readonly<Route>) {
    const firstStopView = new FirstStopView(this, model.source);

    let currentStop: MiddleStopView | LastStopView | null = firstStopView.nextStop;
    const transports: TransportView[] = [];
    const stops: (FirstStopView | MiddleStopView | LastStopView)[] = [firstStopView];
    while (currentStop) {
      stops.push(currentStop);
      transports.push(currentStop.previousTransport);
      currentStop = currentStop.nextStop;
    }
    this.stops = stops;
    this.transports = transports;
  }

  get uuid(): string {
    return this.model.uuid;
  }
}
