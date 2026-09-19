import {Buffer} from 'node:buffer';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {appSecret} from "./util/appSecret";

const HMAC_SIZE = 16;

export interface GeneratedTokenResponse {
  token: string;
  expiryDate: Date;
}

export interface DecodedTokenResponse {
  resourceId: string;
  ownerId: number;
  expiryTimestamp: number;
  expiryDate: Date;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+\$/, '');
}

function fromBase64Url(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

/**
 * generate a manipulation-resistant token
 */
export function generateToken(
  resourceId: string,
  ownerId: number,
  expiryTimestamp: number
): GeneratedTokenResponse {
  const idBuffer = Buffer.from(resourceId, 'utf8');
  if (idBuffer.length > 64) {
    throw new Error("max resourceId id length: 64 chars");
  }

  const dataLength = 4 + 6 + 1 + idBuffer.length;
  const dataBuffer = Buffer.alloc(dataLength);

  let offset = 0;
  dataBuffer.writeUInt32BE(ownerId, offset);
  offset += 4;
  dataBuffer.writeUIntBE(expiryTimestamp, offset, 6);
  offset += 6;
  dataBuffer.writeUInt8(idBuffer.length, offset);
  offset += 1;
  idBuffer.copy(dataBuffer, offset);

  const hmac = createHmac('sha256', appSecret()!);
  hmac.update(dataBuffer);
  const signatureBuffer = hmac.digest().subarray(0, HMAC_SIZE);

  const finalBuffer = Buffer.concat([signatureBuffer, dataBuffer]);
  const token = toBase64Url(finalBuffer);

  return {
    token,
    expiryDate: new Date(expiryTimestamp),
  };
}

/**
 * decode the token, checking for integrity and expiration
 * returns the payload or `null`, if the token is manipulated or expired
 */
export function verifyAndDecode(token: string): DecodedTokenResponse | null {
  try {
    const fullBuffer = fromBase64Url(token);

    // check minimum size (16 bytes signature + 11 bytes minimum payload)
    if (fullBuffer.length < HMAC_SIZE + 11) {
      return null;
    }

    const providedSignature = fullBuffer.subarray(0, HMAC_SIZE);
    const dataBuffer = fullBuffer.subarray(HMAC_SIZE);

    const hmac = createHmac('sha256', appSecret());
    hmac.update(dataBuffer);
    const expectedSignature = hmac.digest().subarray(0, HMAC_SIZE);

    // check integrity (protection against manipulation)
    if (!timingSafeEqual(providedSignature, expectedSignature)) {
      return null;
    }

    let offset = 0;
    const ownerId = dataBuffer.readUInt32BE(offset);
    offset += 4;

    const expiryTimestamp = dataBuffer.readUIntBE(offset, 6);
    offset += 6;

    // check expiration
    if (Date.now() > expiryTimestamp) {
      return null;
    }

    const idLength = dataBuffer.readUInt8(offset);
    offset += 1;

    const resourceId = dataBuffer.toString('utf8', offset, offset + idLength);

    return {
      resourceId,
      ownerId,
      expiryTimestamp,
      expiryDate: new Date(expiryTimestamp),
    };
  } catch {
    return null;
  }
}
