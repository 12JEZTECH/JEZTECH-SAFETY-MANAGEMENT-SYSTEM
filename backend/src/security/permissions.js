const matrix={
 super_admin:['*'],
 admin:['users:read','users:manage','sites:read','sites:manage','incidents:read','incidents:manage','incidents:approve','permits:read','permits:create','permits:approve','inspections:read','inspections:create','inspections:signoff','findings:manage','capa:manage','reports:read','security:read','audit:read'],
 safety_department:['sites:read','incidents:read','incidents:create','incidents:update','permits:read','permits:create','permits:submit','inspections:read','inspections:create','findings:manage','capa:manage','reports:read','audit:read'],
 supervisor:['sites:read','incidents:read','incidents:create','incidents:update','permits:read','permits:create','permits:submit','capa:read','capa:update','reports:read'],
 user:['sites:read','incidents:create','incidents:read:self','reports:read:self'],
 auditor_officer:['sites:read','incidents:read','permits:read','inspections:read','inspections:create','inspections:signoff','findings:manage','capa:read','capa:verify','reports:read','audit:read'],
 wall_display_kiosk:['dashboard:read']
};
export function hasPermission(role,permission){
 const grants=matrix[role]||[];
 return grants.includes('*')||grants.includes(permission);
}
export function permissionsFor(role){return [...(matrix[role]||[])];}
