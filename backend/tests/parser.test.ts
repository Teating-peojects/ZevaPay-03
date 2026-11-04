import { describe, expect, it } from "vitest";
import { parseNotification } from "../src/parser/index.js";
import { SAMPLE_NOTIFICATIONS } from "../src/parser/samples.js";
import {
  extractAmount,
  extractPhone,
  extractProviderRef,
} from "../src/parser/common.js";

const AUTO_ACCEPT = 0.9;

describe("provider parsers", () => {
  it.each(SAMPLE_NOTIFICATIONS.map((sample) => [sample.provider, sample] as const))(
    "%s sample routes to the expected outcome",
    (_provider, sample) => {
      const { result } = parseNotification(sample.text, {
        expectedProvider: sample.provider,
      });

      const autoAccepted = result.confidence >= AUTO_ACCEPT;
      expect(autoAccepted).toBe(sample.expect === "auto_accept");
    },
  );

  it("extracts the amount from a bKash notification", () => {
    const { result } = parseNotification(
      "bKash: You have received Tk 2,450.00 from Rakib Chowdhury. TrxID: 8H2K4L9M.",
      { expectedProvider: "BKASH" },
    );

    expect(result.amount).toBe(2450);
    expect(result.customerName).toBe("Rakib Chowdhury");
    expect(result.providerRef).toBe("8H2K4L9M");
    expect(result.outcome).toBe("payment_received");
  });

  it("does not mistake a transaction id for an amount", () => {
    const { result } = parseNotification(
      "Nagad: Transaction could not be completed. TxnID: NGD330091.",
      { expectedProvider: "NAGAD" },
    );

    expect(result.amount).toBeNull();
    expect(result.providerRef).toBe("NGD330091");
    expect(result.outcome).toBe("payment_failed");
  });

  it("treats an outgoing debit as unambiguous", () => {
    const { result } = parseNotification(
      "Tk 560.00 debited. Balance depleted. TxnID: RKT220145.",
      { expectedProvider: "ROCKET" },
    );

    expect(result.outcome).toBe("payment_debited");
    expect(result.direction).toBe("debit");
    expect(result.confidence).toBe(1);
  });

  it("routes an unrecognised message to review with no confidence", () => {
    const { result, ambiguous } = parseNotification("hello there");

    expect(ambiguous).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.missing).toContain("amount");
  });

  it("selects the parser from the message body when no hint is given", () => {
    const { parser } = parseNotification(
      "Upay: Payment received Tk 3,400.00 from Sadia Islam. Ref: UPY993012.",
    );

    expect(parser).toBe("UPAY");
  });
});

describe("extraction helpers", () => {
  it("reads amounts written with a currency prefix", () => {
    expect(extractAmount("You received Tk 1,750.00 today")).toBe(1750);
    expect(extractAmount("BDT 500 received")).toBe(500);
  });

  it("ignores reference numbers and dates when reading an amount", () => {
    expect(extractAmount("TxnID: NGD330091")).toBeNull();
    expect(extractAmount("Date: 2026-11-02 16:58")).toBeNull();
  });

  it("reads phone numbers written with separators", () => {
    expect(extractPhone("Mobile: 01866-221334")).toBe("01866221334");
    expect(extractPhone("Mobile: 01999 112233")).toBe("01999112233");
  });

  it("reads provider references in their various spellings", () => {
    expect(extractProviderRef("TrxID: 8H2K4L9M")).toBe("8H2K4L9M");
    expect(extractProviderRef("TxnID: NGD778812")).toBe("NGD778812");
    expect(extractProviderRef("Ref: UPY993012")).toBe("UPY993012");
  });
});
