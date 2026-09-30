import { unzipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { businessStatus } from "./client.ts";
import { fail } from "./errors.ts";
import { compactDateSchema, corpCodeSchema, parse, symbolSchema } from "./schema.ts";

const MAX_XML_BYTES = 100 * 1024 * 1024;
const indexSchema = z.object({ result: z.object({ list: z.array(z.object({
  corp_code: corpCodeSchema, corp_name: z.string().min(1).max(1000),
  stock_code: z.union([symbolSchema, z.literal("")]), modify_date: compactDateSchema,
})).min(1).max(500000) }) });
function parseXml(bytes: Uint8Array): unknown {
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail("SCHEMA"); }
  // No DTDs, custom or external entities. Keep codes as strings, including 0s.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) fail("SCHEMA");
  try {
    return new XMLParser({
      parseTagValue: false, parseAttributeValue: false, ignoreAttributes: true,
      processEntities: false, ignoreDeclaration: true, isArray: (name) => name === "list",
    }).parse(xml);
  } catch { return fail("SCHEMA"); }
}
export function corporation(bytes: Uint8Array, symbol: string) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const error = parse(z.object({ result: z.object({ status: z.string() }) }), parseXml(bytes));
    businessStatus(error.result);
    fail("SCHEMA");
  }
  let files: Record<string, Uint8Array>;
  let entries = 0;
  try {
    files = unzipSync(bytes, { filter: (entry) => {
      entries++;
      // A single allowlisted in-memory XML entry; never extract to disk paths.
      if (entries !== 1 || entry.name.toUpperCase() !== "CORPCODE.XML" ||
          !Number.isSafeInteger(entry.originalSize) || entry.originalSize <= 0 ||
          entry.originalSize > MAX_XML_BYTES || ![0, 8].includes(entry.compression)) fail("TOO_LARGE");
      return true;
    } });
  } catch { return fail("SCHEMA"); }
  const xml = Object.values(files)[0];
  if (!xml || entries !== 1 || xml.length > MAX_XML_BYTES) fail("SCHEMA");
  const rows = parse(indexSchema, parseXml(xml)).result.list;
  const matches = rows.filter((row) => row.stock_code === symbol);
  if (matches.length !== 1) fail("SCHEMA");
  return matches[0]!;
}
