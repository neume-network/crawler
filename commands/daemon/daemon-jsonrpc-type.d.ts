/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type DaemonJsonrpcType = Request | Request[];
export type Request = GetIdsChangedFill | GetUserContracts;

export interface GetIdsChangedFill {
  jsonrpc: "2.0";
  id: string;
  method: "getIdsChanged_fill";
  /**
   * @minItems 2
   * @maxItems 2
   */
  params: [number, number];
  [k: string]: unknown;
}
export interface GetUserContracts {
  jsonrpc: "2.0";
  id: string;
  method: "getUserContracts";
  [k: string]: unknown;
}

