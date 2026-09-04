export const responsiveRecompositionStrategies = {
  summaryToDetail: "SUMMARY_TO_DETAIL",
  tableToRecord: "TABLE_TO_RECORD",
  tabsToRailOrSelector: "TABS_TO_RAIL_OR_SELECTOR",
  actionsToOverflow: "ACTIONS_TO_OVERFLOW",
  statusToCompactBadge: "STATUS_TO_COMPACT_BADGE",
  sidebarToDrawerOrSelector: "SIDEBAR_TO_DRAWER_OR_SELECTOR",
  stickyTaskControls: "STICKY_TASK_CONTROLS",
} as const;

export type ResponsiveRecompositionStrategy =
  (typeof responsiveRecompositionStrategies)[keyof typeof responsiveRecompositionStrategies];
