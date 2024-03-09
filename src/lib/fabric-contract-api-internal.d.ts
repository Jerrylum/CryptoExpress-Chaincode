
export declare namespace annotationsUtils {
  function appendOrUpdate<D extends { [key in F]: T }, T, F extends string>(arr: D[], primaryField: F, id: T, data: Omit<D, F>): void;

  function findByValue<D extends { [key in F]: T }, T, F extends string>(arr: D[], primaryField: F, id: T): D | null;

  function generateSchema(type: any, fullPath?: boolean): any;
}

