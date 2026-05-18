import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("log/:planExId", "routes/log.$planExId.tsx"),
  route("complete", "routes/complete.tsx"),
  route("history", "routes/history.tsx"),
] satisfies RouteConfig;
