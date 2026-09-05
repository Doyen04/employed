export type JsonPrimitive = string | number | boolean
export type JsonObject = { [key: string]: JsonValue | null }
export type JsonArray = (JsonValue | null)[]
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export function toJsonValue(value: unknown): JsonValue {
  return value as JsonValue
}