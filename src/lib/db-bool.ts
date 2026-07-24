// Oracle has no native boolean type; RECRUIT_T_* boolean columns are
// NUMBER(1) with a CHECK (col IN (0,1)). The oracledb driver returns these
// as raw JS numbers, so every boolean column needs conversion at both the
// read boundary (DB -> API response) and the write boundary (API body -> DB).
export function fromBool(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

export function toBool(value: boolean | null | undefined): number {
  return value ? 1 : 0;
}
