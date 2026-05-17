export enum FeatureChangeType {
  VISUAL = "visual",
  FRONTEND = "frontend",
  BACKEND = "backend",
  INFRA = "infra"
}

export const FEATURE_CHANGE_TYPE_DESCRIPTIONS: Record<FeatureChangeType, string> = {
  [FeatureChangeType.VISUAL]: "Markup-only changes: HTML, templates, styles, design tokens.",
  [FeatureChangeType.FRONTEND]:
    "Frontend code behind the markup: components, modules, services, state stores, view-models.",
  [FeatureChangeType.BACKEND]: "Backend code: HTTP APIs, SOAP, message handlers, controllers, jobs.",
  [FeatureChangeType.INFRA]:
    "Cross-cutting infrastructure: helpers, extensions, shared libs, repository layer, factory pattern."
};
