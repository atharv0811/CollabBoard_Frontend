import type { CanvasElement, ElementStyle, Point } from "../workspace/canvas/elements.ts";
import { clampZoom, type Viewport } from "../workspace/canvas/viewport.ts";
import { BOARD_SCHEMA_VERSION, type BoardDocument, type BoardMeta } from "./model.ts";

export class InvalidRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRecordError";
  }
}

export class IncompatibleVersionError extends InvalidRecordError {
  readonly version: number;

  constructor(version: number) {
    super(`Saved with a newer version of CollabBoard (format ${version}).`);
    this.name = "IncompatibleVersionError";
    this.version = version;
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function fail(message: string): never {
  throw new InvalidRecordError(message);
}

function readNumber(record: UnknownRecord, key: string, where: string): number {
  const value = record[key];
  if (!isFiniteNumber(value)) fail(`${where}: "${key}" must be a finite number.`);
  return value;
}

function readString(record: UnknownRecord, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) fail(`${where}: "${key}" must be a non-empty string.`);
  return value;
}

function readPoint(value: unknown, where: string): Point {
  if (!isRecord(value)) fail(`${where} must be a point.`);
  return { x: readNumber(value, "x", where), y: readNumber(value, "y", where) };
}

function readStyle(value: unknown, where: string): ElementStyle {
  if (!isRecord(value)) fail(`${where}: "style" is missing.`);
  const strokeWidth = readNumber(value, "strokeWidth", `${where} style`);
  if (strokeWidth < 0) fail(`${where}: stroke width cannot be negative.`);
  if (typeof value.fill !== "string") fail(`${where}: "fill" must be a string.`);
  return { strokeWidth, fill: value.fill };
}

function readSize(record: UnknownRecord, key: string, where: string): number {
  const value = readNumber(record, key, where);
  if (value < 0) fail(`${where}: "${key}" cannot be negative.`);
  return value;
}

export function parseElement(value: unknown, index: number): CanvasElement {
  const where = `Element ${index}`;
  if (!isRecord(value)) fail(`${where} is not an object.`);
  const id = readString(value, "id", where);
  const style = readStyle(value.style, where);

  switch (value.type) {
    case "rectangle":
    case "diamond":
      return {
        id,
        type: value.type,
        style,
        x: readNumber(value, "x", where),
        y: readNumber(value, "y", where),
        width: readSize(value, "width", where),
        height: readSize(value, "height", where),
      };
    case "ellipse":
      return {
        id,
        type: "ellipse",
        style,
        cx: readNumber(value, "cx", where),
        cy: readNumber(value, "cy", where),
        rx: readSize(value, "rx", where),
        ry: readSize(value, "ry", where),
      };
    case "line":
    case "arrow":
      return {
        id,
        type: value.type,
        style,
        start: readPoint(value.start, `${where} start`),
        end: readPoint(value.end, `${where} end`),
      };
    case "freehand": {
      if (!Array.isArray(value.points) || value.points.length === 0) fail(`${where}: "points" must be a non-empty list.`);
      return { id, type: "freehand", style, points: value.points.map((point, i) => readPoint(point, `${where} point ${i}`)) };
    }
    default:
      return fail(`${where}: unknown type ${JSON.stringify(value.type)}.`);
  }
}

export function parseViewport(value: unknown): Viewport {
  if (!isRecord(value)) fail("Viewport is missing.");
  const zoom = readNumber(value, "zoom", "Viewport");
  if (zoom <= 0) fail("Viewport zoom must be positive.");
  return { x: readNumber(value, "x", "Viewport"), y: readNumber(value, "y", "Viewport"), zoom: clampZoom(zoom) };
}

type Migration = (record: UnknownRecord) => UnknownRecord;

export const DOCUMENT_MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function readSchemaVersion(record: UnknownRecord): number {
  const version = record.schemaVersion;
  if (!Number.isInteger(version) || (version as number) < 1) fail("Missing or invalid schema version.");
  return version as number;
}

export function migrateDocumentRecord(
  record: UnknownRecord,
  migrations: Readonly<Record<number, Migration>> = DOCUMENT_MIGRATIONS,
  target = BOARD_SCHEMA_VERSION,
): UnknownRecord {
  let version = readSchemaVersion(record);
  if (version > target) throw new IncompatibleVersionError(version);
  let current = record;
  while (version < target) {
    const migrate = migrations[version];
    if (!migrate) fail(`No migration from format ${version}.`);
    current = { ...migrate(current), schemaVersion: version + 1 };
    version += 1;
  }
  return current;
}

export function parseBoardDocument(raw: unknown): BoardDocument {
  if (!isRecord(raw)) fail("Board content is not an object.");
  const record = migrateDocumentRecord(raw);
  if (!Array.isArray(record.elements)) fail('"elements" must be a list.');
  const elements = record.elements.map(parseElement);
  const ids = new Set<string>();
  for (const element of elements) {
    if (ids.has(element.id)) fail(`Duplicate element id "${element.id}".`);
    ids.add(element.id);
  }
  return { elements, viewport: parseViewport(record.viewport) };
}

export function parseBoardMeta(raw: unknown): BoardMeta {
  if (!isRecord(raw)) fail("Board record is not an object.");
  const version = readSchemaVersion(raw);
  if (version > BOARD_SCHEMA_VERSION) throw new IncompatibleVersionError(version);
  const name = raw.name;
  if (typeof name !== "string" || !name.trim()) fail('"name" must be a non-empty string.');
  return {
    id: readString(raw, "id", "Board"),
    name,
    createdAt: readNumber(raw, "createdAt", "Board"),
    updatedAt: readNumber(raw, "updatedAt", "Board"),
  };
}
