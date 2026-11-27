import type { Role, WithId } from './types';

export function normalizedRoleName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

export function sameNamedRoles(role: Role, roles: WithId<Role>[]): WithId<Role>[] {
  return roles.filter((other) => other.scope === role.scope && normalizedRoleName(other.name) === normalizedRoleName(role.name));
}

/** Aynı adlı kayıtlarda yanlış rolü seçmeyi önler; kaydın adını değiştirmez. */
export function roleChoiceLabel(role: WithId<Role>, roles: WithId<Role>[]): string {
  return sameNamedRoles(role, roles).length > 1 ? `${role.name} · ${role.id}` : role.name;
}
