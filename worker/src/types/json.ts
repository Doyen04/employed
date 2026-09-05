export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export function toJsonValue(value: unknown): JsonValue {
  return value as JsonValue
}