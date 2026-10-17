import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ReachPoseRecorder } from "@/reach/ReachPoseRecorder";
export const metadata = {
  title: "Local hand recording · Voyagewright",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function ReachPoseRecordingPage() {
  if (process.env.REACH_LOCAL_POSE_CAPTURE !== "1") notFound();
  const host = (await headers()).get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) notFound();
  return <ReachPoseRecorder />;
}
