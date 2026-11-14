import snapshotRecords from "./data/credit-snapshot.json";
import { creditBook, type CreditBook, type CreditRecord } from "./credits";

export function loadCreditBook(): CreditBook {
  return creditBook(snapshotRecords as CreditRecord[]);
}
