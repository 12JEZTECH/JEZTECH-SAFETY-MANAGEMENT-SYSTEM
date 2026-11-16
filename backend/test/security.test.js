import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTotpSecret,totpAt,verifyTotp,encryptSecret,decryptSecret} from '../src/services/totp.js';
import {hasPermission,permissionsFor} from '../src/security/permissions.js';

test('TOTP secrets generate valid time-based codes',()=>{
 const secret=generateTotpSecret();
 const code=totpAt(secret);
 assert.match(code,/^\d{6}$/);
 assert.equal(verifyTotp(secret,code),true);
 assert.equal(verifyTotp(secret,'0000000'),false);
});
test('MFA secrets are encrypted and decrypt only with configured key',()=>{
 process.env.MFA_ENCRYPTION_KEY='unit_test_only_mfa_encryption_key_at_least_32_chars';
 const encrypted=encryptSecret('JBSWY3DPEHPK3PXP');
 assert.notEqual(encrypted,'JBSWY3DPEHPK3PXP');
 assert.equal(decryptSecret(encrypted),'JBSWY3DPEHPK3PXP');
});
test('role permissions enforce least privilege',()=>{
 assert.equal(hasPermission('super_admin','arbitrary:action'),true);
 assert.equal(hasPermission('user','incidents:create'),true);
 assert.equal(hasPermission('user','permits:approve'),false);
 assert.equal(hasPermission('auditor_officer','permits:approve'),false);
 assert.equal(hasPermission('supervisor','permits:submit'),true);
 assert.equal(hasPermission('safety_department','security:read'),false);
 assert.ok(permissionsFor('user').length<permissionsFor('super_admin').length);
});
