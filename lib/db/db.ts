/**
 * Copyright 2013-2019  GenieACS Inc.
 *
 * This file is part of GenieACS.
 *
 * GenieACS is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * GenieACS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with GenieACS.  If not, see <http://www.gnu.org/licenses/>.
 */

import { MongoClient, Collection, GridFSBucket } from "mongodb";
import { get } from "../config";
import * as MongoTypes from "./types";

export let filesBucket: GridFSBucket;

export const collections = {
  devices: null as Collection<MongoTypes.Device>,
  presets: null as Collection<MongoTypes.Preset>,
  objects: null as Collection<MongoTypes.Object>,
  provisions: null as Collection<MongoTypes.Provision>,
  virtualParameters: null as Collection<MongoTypes.VirtualParameter>,
  faults: null as Collection<MongoTypes.Fault>,
  tasks: null as Collection<MongoTypes.Task>,
  files: null as Collection<MongoTypes.File>,
  operations: null as Collection<MongoTypes.Operation>,
  permissions: null as Collection<MongoTypes.Permission>,
  users: null as Collection<MongoTypes.User>,
  config: null as Collection<MongoTypes.Config>,
  cache: null as Collection<MongoTypes.Cache>,
  locks: null as Collection<MongoTypes.Lock>,
};

let clientPromise: Promise<MongoClient>;

export async function connect(): Promise<void> {
  clientPromise = MongoClient.connect("" + get("MONGODB_CONNECTION_URL"));

  const client = await clientPromise;
  const db = client.db();

  collections.tasks = db.collection("tasks");
  collections.devices = db.collection("devices");
  collections.presets = db.collection("presets");
  collections.objects = db.collection("objects");
  collections.files = db.collection("fs.files");
  collections.provisions = db.collection("provisions");
  collections.virtualParameters = db.collection("virtualParameters");
  collections.faults = db.collection("faults");
  collections.operations = db.collection("operations");
  collections.permissions = db.collection("permissions");
  collections.users = db.collection("users");
  collections.config = db.collection("config");
  collections.cache = db.collection("cache");
  collections.locks = db.collection("locks");
  filesBucket = new GridFSBucket(db);

  await Promise.all([
    collections.tasks.createIndex({ device: 1, timestamp: 1 }),
    collections.cache.createIndex({ expire: 1 }),
    collections.locks.createIndex({ expire: 1 }),
  ]);
}

export async function disconnect(): Promise<void> {
  if (clientPromise != null) await (await clientPromise).close();
}
