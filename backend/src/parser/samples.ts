/**
 * Realistic sample notifications used by the device simulator and the parser
 * tests. The wording mirrors what the providers' SMS actually look like, but
 * every reference id is synthetic.
 */
export interface SampleNotification {
  provider: "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  /** Expected parse outcome — used by the simulator to report drift. */
  expect: "auto_accept" | "review";
  /** Expected transaction status once ingested. */
  status?: "CREATED" | "PENDING" | "REVIEW" | "CONFIRMED" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED";
  text: string;
}

export const SAMPLE_NOTIFICATIONS: SampleNotification[] = [
  {
    provider: "BKASH",
    expect: "auto_accept",
    text: "bKash: You have received Tk 2,450.00 from Rakib Chowdhury. TrxID: 8H2K4L9M. Ref: BKSEND01.",
  },
  {
    provider: "BKASH",
    expect: "auto_accept",
    text: "bKash: You have received Tk 1,750.00 from Jahangir Alam. TrxID: 9X1C5V3B. Mobile: 01723-445566.",
  },
  {
    provider: "BKASH",
    expect: "review",
    text: "You have received Tk 12,750.00 from Rezaul Karim.",
  },
  {
    provider: "NAGAD",
    expect: "auto_accept",
    text: "Nagad: Tk 890.00 received. Sender: Shahriar Alam. TxnID: NGD778812. Date: 2026-11-02 16:58",
  },
  {
    provider: "NAGAD",
    expect: "auto_accept",
    text: "Nagad: Tk 620.00 received. Sender: Ayesha Siddika. TxnID: NGD550144. Mobile: 01999-112233.",
  },
  {
    provider: "NAGAD",
    expect: "review",
    text: "Nagad: Tk 5,600.00 received.",
  },
  {
    provider: "NAGAD",
    expect: "auto_accept",
    status: "FAILED",
    text: "Nagad: Transaction could not be completed. TxnID: NGD330091.",
  },
  {
    provider: "ROCKET",
    expect: "auto_accept",
    text: "Tk 8,900.00 received. Sender: Fresh Cart Order #4471. TxnID: RKT440982. Date: 2026-11-02 14:02",
  },
  {
    provider: "ROCKET",
    expect: "auto_accept",
    status: "FAILED",
    text: "Tk 560.00 debited. Balance depleted. TxnID: RKT220145.",
  },
  {
    provider: "ROCKET",
    expect: "review",
    text: "Tk 620.00 received.",
  },
  {
    provider: "UPAY",
    expect: "auto_accept",
    text: "Upay: Payment received Tk 3,400.00 from Sadia Islam. Ref: UPY993012. Date: 2026-11-02 14:12",
  },
  {
    provider: "UPAY",
    expect: "auto_accept",
    text: "Upay: Payment received Tk 1,450.00 from Imtiaz Hossain. Ref: UPY556701. Mobile: 01688-331220.",
  },
  {
    provider: "UPAY",
    expect: "review",
    text: "Payment received Tk 1,290.00.",
  },
];
