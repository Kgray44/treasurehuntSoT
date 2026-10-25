import {
  isPR776ControllerReconciliation,
  pr776HistoricalReviewedPlan,
  validatePR776ReviewedIdentity,
  pr776ReviewedAdoption,
} from "./experience-pr776-controller-reconciliation.mjs";
// Fixed, explicitly installed successors retain the original R23 review.
// This selector creates no preparation, capture, review or execution right.
import { isR24, r24HistoricalPlan, validateR24ReviewedIdentity, r24Adoption } from "./experience-current-r24.mjs";
import { isR25, r25HistoricalPlan, validateR25ReviewedIdentity, r25Adoption } from "./experience-current-r25.mjs";
import { isR26, r26HistoricalPlan, validateR26ReviewedIdentity, r26Adoption } from "./experience-current-r26.mjs";
export const isReviewedEvidenceAdoption = (plan) =>
  isPR776ControllerReconciliation(plan) || isR24(plan) || isR25(plan) || isR26(plan);
export const historicalReviewedPlan = (plan) =>
  isPR776ControllerReconciliation(plan)
    ? pr776HistoricalReviewedPlan(plan)
    : isR26(plan)
      ? r26HistoricalPlan(plan)
      : isR25(plan)
        ? r25HistoricalPlan(plan)
        : r24HistoricalPlan(plan);
export const validateReviewedIdentity = (plan, evidence, options) =>
  isPR776ControllerReconciliation(plan)
    ? validatePR776ReviewedIdentity(plan, evidence, options)
    : isR26(plan)
      ? validateR26ReviewedIdentity(plan, evidence)
      : isR25(plan)
        ? validateR25ReviewedIdentity(plan, evidence)
        : validateR24ReviewedIdentity(plan, evidence);
export const reviewedEvidenceAdoption = (plan) =>
  isPR776ControllerReconciliation(plan)
    ? pr776ReviewedAdoption(plan)
    : isR26(plan)
      ? r26Adoption(plan)
      : isR25(plan)
        ? r25Adoption(plan)
        : r24Adoption(plan);
