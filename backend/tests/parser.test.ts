import { describe, expect, it } from "vitest";
import { parseNotification } from "../src/parser/index.js";
import { SAMPLE_NOTIFICATIONS } from "../src/parser/samples.js";
import {
  extractAmount,
  extractPhone,
  extractProviderRef,
  extractSenderReference,
  extractTimestamp,
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

describe("bKash notification with a sender note", () => {
  // A real notification: the sender's note (`Ref ajaj`) comes before the
  // provider's own transaction id (`TrxID DK3508MJ4R`).
  const REAL_SMS =
    "You have received Tk 3,000.00 from 01608576689. Ref ajaj. Fee Tk 0.00. Balance Tk 3,052.58. TrxID DK3508MJ4R at 03/11/2026 18:09";

  it("reads the TrxID, not the sender's note", () => {
    const { result } = parseNotification(REAL_SMS, { expectedProvider: "BKASH" });

    expect(result.providerRef).toBe("DK3508MJ4R");
    expect(result.senderReference).toBe("ajaj");
  });

  it("reads the amount and the sender, not the fee or the balance", () => {
    const { result } = parseNotification(REAL_SMS, { expectedProvider: "BKASH" });

    expect(result.amount).toBe(3000);
    expect(result.customerPhone).toBe("01608576689");
    expect(result.outcome).toBe("payment_received");
  });

  it("reads the day-first date as 3 November 2026, Bangladesh time", () => {
    const { result } = parseNotification(REAL_SMS, { expectedProvider: "BKASH" });

    expect(result.occurredAt?.toISOString()).toBe("2026-11-03T12:09:00.000Z");
    expect(result.missing).not.toContain("occurredAt");
  });

  it("keeps a sender note that has several words", () => {
    expect(
      extractSenderReference(
        "Received Tk 500.00. Ref order 1182. Fee Tk 0.00. TrxID AB12CD34EF",
      ),
    ).toBe("order 1182");
  });

  it("reports no sender note when there is none", () => {
    expect(
      extractSenderReference("You have received Tk 500.00. TrxID AB12CD34EF"),
    ).toBeNull();
  });

  it("does not report a Ref used as the transaction id as a sender note", () => {
    expect(extractProviderRef("Payment received. Ref: UPY993012.")).toBe("UPY993012");
    expect(extractSenderReference("Payment received. Ref: UPY993012.")).toBeNull();
  });
});

describe("timestamps", () => {
  it("reads 12-hour times", () => {
    expect(extractTimestamp("on 03/11/2026 06:09 PM")?.toISOString()).toBe(
      "2026-11-03T12:09:00.000Z",
    );
    expect(extractTimestamp("on 03/11/2026 12:05 AM")?.toISOString()).toBe(
      "2026-11-02T18:05:00.000Z",
    );
  });

  it("reads the ISO form as Bangladesh time", () => {
    expect(extractTimestamp("Date: 2026-11-02 16:58")?.toISOString()).toBe(
      "2026-11-02T10:58:00.000Z",
    );
  });

  it("rejects a date that does not exist", () => {
    expect(extractTimestamp("at 31/02/2026 10:00")).toBeNull();
    expect(extractTimestamp("at 13/13/2026 10:00")).toBeNull();
  });
});
