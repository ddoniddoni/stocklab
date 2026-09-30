import { z } from "zod";
import { fail } from "./errors.ts";

export const codes = ["11013", "11012", "11014", "11011"] as const;
export const metrics = ["revenue", "operatingProfit", "netProfit", "assets", "liabilities", "equity", "operatingCashFlow", "investingCashFlow", "financingCashFlow"] as const;
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const runIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
export const corpCodeSchema = z.string().regex(/^\d{8}$/);
export const symbolSchema = z.string().regex(/^\d{6}$/);
export const receiptSchema = z.string().regex(/^\d{14}$/);
export const compactDateSchema = z.string().regex(/^\d{8}$/).refine((value) =>
  z.iso.date().safeParse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`).success);
const text = z.string().max(1000);
const amount = z.string().max(200).nullish();
export const companySchema = z.object({
  corp_name: text.min(1), stock_code: symbolSchema,
  corp_cls: z.enum(["Y", "K", "N", "E"]), acc_mt: z.string().regex(/^(0[1-9]|1[0-2])$/),
});
export const filingSchema = z.object({
  corp_code: corpCodeSchema, corp_name: text.min(1), stock_code: z.union([symbolSchema, z.literal("")]),
  report_nm: text.min(1), rcept_no: receiptSchema, rcept_dt: compactDateSchema,
  rm: text.optional().default(""),
});
export const filingPageSchema = z.object({
  page_no: z.coerce.number().int().positive(), page_count: z.coerce.number().int().min(1).max(100),
  total_count: z.coerce.number().int().min(0), total_page: z.coerce.number().int().min(0).max(10000),
  list: z.array(filingSchema).max(100),
});
export const rowSchema = z.object({
  rcept_no: receiptSchema, reprt_code: z.enum(codes), bsns_year: z.string().regex(/^\d{4}$/),
  corp_code: corpCodeSchema, sj_div: z.enum(["BS", "IS", "CIS", "CF", "SCE"]),
  account_id: text.min(1), account_nm: text.min(1), account_detail: text.optional().default(""),
  thstrm_nm: text, thstrm_amount: amount, thstrm_add_amount: amount,
  currency: z.string().regex(/^[A-Z]{3}$/), ord: z.union([text, z.number().int()]).optional(),
  // Some responses may add the requested basis; if present it must agree.
  fs_div: z.enum(["CFS", "OFS"]).optional(),
});
export const financialSchema = z.object({ list: z.array(rowSchema).min(1).max(10000) });
export const planSchema = z.object({
  symbol: symbolSchema, year: z.number().int().min(2015).max(2100),
  basis: z.enum(["CFS", "OFS"]), reports: z.array(z.enum(codes)).min(1).max(4),
  until: compactDateSchema,
}).strict();
export type Plan = z.infer<typeof planSchema>;
export const artifactSchema = z.object({
  hash: hashSchema, fetchedAt: z.iso.datetime(), empty: z.boolean(),
}).strict();
export type Artifact = z.infer<typeof artifactSchema>;
export const stateSchema = z.object({
  schemaVersion: z.literal(1), runId: runIdSchema, plan: planSchema,
  startedAt: z.iso.datetime(), status: z.enum(["running", "failed", "cancelled", "complete"]),
  requests: z.number().int().min(0).max(1000), requestBudget: z.number().int().min(1).max(1000),
  lastRequestAt: z.number().min(0),
  tasks: z.record(z.string().regex(/^[a-z0-9-]+$/), artifactSchema),
  error: z.string().max(40).nullable(), candidateHash: hashSchema.nullable(),
}).strict();
export type State = z.infer<typeof stateSchema>;
export type Row = z.infer<typeof rowSchema>;
export type Filing = z.infer<typeof filingSchema>;
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) fail("SCHEMA");
  return result.data;
}
export function json(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return fail("SCHEMA"); }
}
export function originalUrl(receipt: string) {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${parse(receiptSchema, receipt)}`;
}
