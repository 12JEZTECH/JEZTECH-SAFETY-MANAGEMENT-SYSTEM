import crypto from 'node:crypto';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function generateTotpSecret(bytes=20) {
  const raw=crypto.randomBytes(bytes); let bits=0, value=0, out='';
  for (const byte of raw) { value=(value<<8)|byte; bits+=8; while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;} }
  if(bits) out+=alphabet[(value<<(5-bits))&31];
  return out;
}
function decodeBase32(value) {
  let bits=0,buffer=0; const out=[];
  for(const char of value.toUpperCase().replace(/=+$/,'')){const idx=alphabet.indexOf(char);if(idx<0)throw new Error('Invalid TOTP secret');buffer=(buffer<<5)|idx;bits+=5;if(bits>=8){out.push((buffer>>>(bits-8))&255);bits-=8;}}
  return Buffer.from(out);
}
export function totpAt(secret, counter=Math.floor(Date.now()/30000)) {
  const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(counter));
  const h=crypto.createHmac('sha1',decodeBase32(secret)).update(msg).digest();
  const offset=h[h.length-1]&15;const binary=((h[offset]&127)<<24)|((h[offset+1]&255)<<16)|((h[offset+2]&255)<<8)|(h[offset+3]&255);
  return String(binary%1000000).padStart(6,'0');
}
export function verifyTotp(secret, token, window=1) {
  if(!/^\d{6}$/.test(String(token||'')))return false;
  const now=Math.floor(Date.now()/30000);
  for(let drift=-window;drift<=window;drift++){const expected=totpAt(secret,now+drift);if(crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(token))))return true;}
  return false;
}
function encryptionKey(){const value=process.env.MFA_ENCRYPTION_KEY;if(!value||value.length<32)throw Object.assign(new Error('MFA_ENCRYPTION_KEY must be configured with at least 32 characters.'),{status:503});return crypto.createHash('sha256').update(value).digest();}
export function encryptSecret(plain){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');}
export function decryptSecret(value){const [iv,tag,data]=String(value||'').split('.');if(!iv||!tag||!data)throw new Error('Invalid encrypted MFA secret');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64'));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');}
