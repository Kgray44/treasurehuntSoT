// Fixed, explicitly installed successors retain the original R23 review.
// This selector creates no preparation, capture, review or execution right.
import { isR24, r24HistoricalPlan, validateR24ReviewedIdentity, r24Adoption } from "./experience-current-r24.mjs";
import { isR25, r25HistoricalPlan, validateR25ReviewedIdentity, r25Adoption } from "./experience-current-r25.mjs";
export const isReviewedEvidenceAdoption = (plan) => isR24(plan) || isR25(plan);
export const historicalReviewedPlan = (plan) => (isR25(plan) ? r25HistoricalPlan(plan) : r24HistoricalPlan(plan));
export const validateReviewedIdentity = (plan, evidence) =>
  isR25(plan) ? validateR25ReviewedIdentity(plan, evidence) : validateR24ReviewedIdentity(plan, evidence);
export const reviewedEvidenceAdoption = (plan) => (isR25(plan) ? r25Adoption(plan) : r24Adoption(plan));
