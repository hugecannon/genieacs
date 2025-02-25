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

import * as url from "url";
import { IncomingMessage, ServerResponse } from "http";
import { PassThrough, pipeline, Readable } from "stream";
import { filesBucket, collections } from "./db/db";
import * as logger from "./logger";
import { getRequestOrigin } from "./forwarded";
import memoize from "./common/memoize";

const getFile = memoize(
  async (
    uploadDate: number,
    size: number,
    filename: string
  ): Promise<Iterable<Buffer>> => {
    const chunks: Buffer[] = [];
    // Using for-await over the download stream can throw ERR_STREAM_PREMATURE_CLOSE
    // for very small files. Possibly a bug in MongoDB driver or Nodejs itself.
    // Using a PassThrough stream to avoid this.
    const downloadStream = pipeline(
      filesBucket.openDownloadStreamByName(filename),
      new PassThrough(),
      (err) => {
        if (err) throw err;
      }
    );
    for await (const chunk of downloadStream) chunks.push(chunk);
    // Node 12-14 don't throw error when stream is closed prematurely.
    // However, we don't need to check for that since we're checking file size.
    if (size !== chunks.reduce((a, b) => a + b.length, 0))
      throw new Error("File size mismatch");
    return chunks;
  }
);

export async function listener(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("405 Method Not Allowed");
    return;
  }

  const urlParts = url.parse(request.url, true);
  const filename = decodeURIComponent(urlParts.pathname.substring(1));

  const log = {
    message: "Fetch file",
    filename: filename,
    remoteAddress: getRequestOrigin(request).remoteAddress,
    method: request.method,
  };

  const file = await collections.files.findOne({ _id: filename });

  if (!file) {
    response.writeHead(404);
    response.end();
    log.message += " not found";
    logger.accessError(log);
    return;
  }

  response.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": file.length,
  });

  logger.accessInfo(log);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const chunks = await getFile(
    file["uploadDate"].getTime(),
    file.length,
    filename
  );

  pipeline(Readable.from(chunks), response, () => {
    // Ignore errors resulting from client disconnecting
  });
}
