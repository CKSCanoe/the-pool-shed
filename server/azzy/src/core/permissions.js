export function hasPermission(user,permission){ return Boolean(user?.permissions?.includes(permission)); }
export function requirePermission(user,permission){
  if(!hasPermission(user,permission)) throw new Error(`Permission denied: ${permission}`);
}
export function visibleTool(tool,user){ return !tool.permission || hasPermission(user,tool.permission); }
